/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EMULATOR_ACTIONS } from '../devtool/js/actions';
import { EmulatorSettings } from '../devtool/js/emulatorStates';
import { reloadInspectedTab } from '../devtool/js/messenger';

const PORT_DESTINATION_MAPPING = {
	iwe_app: 'iwe_devtool',
	iwe_devtool: 'iwe_app',
};

console.log('Service worker initialized');

const connectedTabs = {};

const injectionId = 'iwe-polyfill-injection';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("received message in service worker");
    if (request.action === 'injectScript') {
        chrome.webNavigation.getAllFrames({ tabId: sender.tab.id }, (frames) => {
            const targetFrame = frames.find(frame => frame.url === request.frameUrl);
            if (targetFrame) {
                chrome.scripting.executeScript({
                    target: { frameIds: [targetFrame.frameId] },
                    files: ['dist/webxr-polyfill.js'],
                    world: 'MAIN'
                }, () => {
                    sendResponse({ status: 'injected' });
                });
            } else {
                sendResponse({ status: 'frame_not_found' });
            }
        });
        return true; // This keeps the message channel open for sendResponse
    }
});

let x = 0;

const updateInjection = (reloadTabId = null) => {
  console.log("update injection – ", reloadTabId)
	EmulatorSettings.instance.load().then(() => {
    x = x + 1;
    if (x == 1 ) {
      console.log("returned")
    } 

		chrome.scripting.getRegisteredContentScripts(
			{ ids: [injectionId] },
			(scripts) => {
				// if (scripts.length == 0) {
				if (true) {
          console.log("tib3 - register content script");
					chrome.scripting.registerContentScripts([
						{
							id: injectionId,
							matches: ['http://*/*', 'https://*/*'],
							js: ['dist/webxr-polyfill.js'],
							allFrames: true,
							runAt: 'document_start',
              matchOriginAsFallback: true,
							world: 'MAIN',
							excludeMatches: Array.from(
								EmulatorSettings.instance.polyfillExcludes,
							),
						},
					]);
				} else {
          console.log("Excludes part")
					scripts.forEach((script) => {
						script.excludeMatches = Array.from(
							EmulatorSettings.instance.polyfillExcludes,
						);
					});
					chrome.scripting.updateContentScripts(scripts, () => {
					  console.log("tibor- reload tab id");
            if (reloadTabId) {
							// chrome.tabs.reload(reloadTabId);
						}
					});
				}
			},
		);
	});
};

const relayMessage = (tabId, port, message) => {
	const destinationPorts =
		connectedTabs[tabId][PORT_DESTINATION_MAPPING[port.name]];
	destinationPorts.forEach((destinationPort) => {
		destinationPort.postMessage(message);
	});
};

chrome.runtime.onConnect.addListener((port) => {
	if (Object.keys(PORT_DESTINATION_MAPPING).includes(port.name)) {
    port.onMessage.addListener((message, sender) => {
			const tabId = message.tabId ?? sender.sender.tab.id;
			if (message.action === EMULATOR_ACTIONS.EXCLUDE_POLYFILL) {
				updateInjection(tabId);
			}
			if (!connectedTabs[tabId]) {
				connectedTabs[tabId] = {};
				Object.keys(PORT_DESTINATION_MAPPING).forEach((portName) => {
					connectedTabs[tabId][portName] = new Set();
				});
			}

			if (!connectedTabs[tabId][port.name].has(port)) {
				connectedTabs[tabId][port.name].add(port);
				port.onDisconnect.addListener(() => {
					connectedTabs[tabId][port.name].delete(port);
				});
			}

			relayMessage(tabId, port, message);
		});
	}
});

updateInjection();
