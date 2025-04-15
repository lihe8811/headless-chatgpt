const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

let browser;
let page;

const _regenButtonXPathSelector = "//div[@class='text-gray-400 flex self-end lg:self-center justify-center lg:justify-start mt-0 gap-1 visible']/button[2]" // as of today (5/12/2023) only the last response has a regen button. (The third child of the above div, being also a button) And thank Todd for that; he did it again.
const _continueButtonXPathSelector = "//button[contains(., 'Continue generating') or contains(., 'Continue')]";
const _newChatButtonXPathSelector = "(//a[@href="/" and contains(text(), chatgpt)])[2]";
const _downloadButtonXPathSelector = "//button[contains(@class, 'hover:bg-token-icon-surface/10') and contains(@class, 'focus:bg-token-icon-surface/10') and @aria-label='Download this image']";
//new chat button attempts: //a[@class='group flex h-10 items-center gap-2 rounded-lg px-2 font-medium hover:bg-token-surface-primary' and contains(., Chatgpt) and .//svg]

const _currentGptModeButtonSelector = "//div[@class='group flex cursor-pointer items-center gap-1 rounded-xl py-2 px-3 text-lg font-medium hover:bg-gray-50 radix-state-open:bg-gray-50 dark:hover:bg-black/10 dark:radix-state-open:bg-black/20']";
const _gptFourChatModeSelector = "(//div[@role='menuitem'])[1]";
const _gptThreeChatModeSelector = "(//div[@role='menuitem'])[2]";
const _pluginsChatModeSelector = "(//div[@role='menuitem'])[3]";
const _generalChatModeMenuButtonSelector = "//div[@role='menuitem']";

const _gptSelectorButtonStub = "//div[@class='pb-0.5 last:pb-0' and ";
const _gptSelectorButtons = "//div[@class='pb-0.5 last:pb-0']";
const _indexedGptSelectorButtonSelectorStub = "(//div[@class='pb-0.5 last:pb-0'])[";

const _oldChatButtonSelector = "//li[@class='relative']/div/a";
const _oldChatButtonSelectorTextStub = "//li[@class='relative']/div/a[contains(.,"; // add "STRING)]"
// working completed stub: //li[@class='relative']/div/a[contains(.,xpath)] no quotes at the end, strangely enough.

const _firstChatButtonSelector = "(//li[@class='relative']/div/a)[1]";
const _lastChatButtonSelector = "(//li[@class='relative']/div/a)[last()]" // this is for scrolling down so that chatgpt gives us older chats as well.

const _chatHistoryContainerSelector = "//nav[@aria-label='Chat history']"

// const _gptFourButtonXPathSelector = "//div[contains(., 'GPT-4')][contains(@class, 'group/button')]";
const _gptFourButtonXPathSelector = "//button[contains(., 'GPT-4')]";
const _gptThreeButtonXPathSelector = "//button[contains(., 'GPT-3.5')]";
const _maxWaitCount = 400;
const _generationWaitStepLength = 500;
const _generationInitialWaitLength = 500;
const _olderChatLoadTime = _generationInitialWaitLength * 6;

const _uploadButtonXPathSelector = "//button[@aria-label='Upload files and more']";
const _uploadFromComputerXPathSelector = "//div[@role='menuitem' and .//div[text()='Upload from computer']]";

async function startBrowser(){
    browser = await puppeteer.launch({
        headless: false
    });
    page = await browser.newPage();
    await page.setViewport({
        width: 1366,
        height: 768,
        deviceScaleFactor: 1,
    });

    // getting saved cookies to avoid
    // Load cookies from JSON file
    try {
        let cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf8'));
        await page.setCookie(...cookies);
    } catch (e) {
    }

    // await page.emulate(iPad);
    // await page.emulateTimezone("Europe/Istanbul");
    await page.emulateTimezone("America/New_York");
}

async function visitPage(url){
    await page.goto(url);
}

async function type(string) {
    await page.keyboard.type(string);
}

async function closeBrowser(){
    await browser.close();
}

async function selectElem(selector, click=true) {
    const element = await page.waitForSelector(selector);
    //
    if (click) {
        await element.click();
    }
    return element;
}

// 0 indexed
async function selectElemWithIndex(selector, index) {    
    return page.$$eval(selector, elems => {
        if (elems.length >= index) {
            return elems[index];
        } else {
            if (elems.length <= 1) {
                return elems;
            } else {
                return elems[elems.length - 1];
            }
        }
    });
}

async function writeInTextArea(selector, string) {
    const element = await page.focus(selector);
    await type(string);
}

async function inputStringInSelector(selector, newValue) {
    await page.waitForSelector(selector);
    const element = await page.$(selector);
    if (element) {
        await page.$eval(selector, (el, value) => el.value = value, newValue);
    } else {
        console.error(`No element found with the selector ${selector}`);
    }
}

async function evalSelect(selector) {
    const result = await page.$$eval(selector, elems => {
        return elems;
    });
    return result;
}

async function evalSelectLastElem(selector) {
    const result = await page.$$eval(selector, elems => {
        const lastElem = elems.length > 1 ? elems[elems.length - 1] : elems[0];
        return lastElem;
    });
    return result;
}

// TODO: for the captcha, look for a button with inner text "Start Puzzle"


async function getInnerHtmlOfLastElem(selector) {
    const result = await page.$$eval(selector, elems => {
        const lastElem = elems.length > 1 ? elems[elems.length - 1] : elems[0];
        return lastElem.innerHTML;
    });
    return result;
}

async function getInnerHtml(selector) {
    const inner_html = await page.$eval(selector, element => element.innerHTML);
    return inner_html;
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickButton(selector) {
    let buttons = await page.$x(selector);
    if (buttons.length > 0) {
        buttons[0].click();
        return 0;
    } else {
        return -1;
    }
}

async function readLastResponse() {
    const answerSelector = "div .markdown";
    let innerHTML = await getInnerHtmlOfLastElem(answerSelector);
    return innerHTML;
}

async function goToChat(chatName) {
    const chatSelector = _oldChatButtonSelectorTextStub + "\"" +  chatName + "\")]";
    clickResponse = clickButton(chatSelector);
    if (clickResponse === -1) {
        console.error(`Error: cannot click chat button for ${chatName}`);
        return clickResponse;
    }
    return 0;
}

async function getChatList () {
    const chatButtons = await page.$x("//li[@class='relative']/div/a");
    let list = [];
    for (const button of chatButtons) {
        const text = await page.evaluate(element => element.textContent, button);
        list.push(text.trim());
    }
    return list;
}

async function loadOlderChats(loadAllChats=false) {
    let chatCount = 0;
    let chatButtons = await page.$x("//li[@class='relative']/div/a");
    if (chatButtons.length < 3) {
        return;
    }
    
    if (loadAllChats) {
        let oldChatCount = chatCount;
        chatCount = chatButtons.length;
        while (oldChatCount != chatCount) {
            const secondLastElement = chatButtons[chatButtons.length - 2];
            await page.evaluate(element => {
                element.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, secondLastElement);

            await timeout(_olderChatLoadTime);
            chatButtons = await page.$x("//li[@class='relative']/div/a");     
            oldChatCount = chatCount;
            chatCount = chatButtons.length;
        }
    } else {
        const secondLastElement = chatButtons[chatButtons.length - 2];
        await page.evaluate(element => {
            element.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, secondLastElement);
        await timeout(_generationInitialWaitLength / 2);
    }
}

async function waitForNewChat() {
    let button = await page.$x(_currentGptModeButtonSelector);
    while (!button || button.length == 0) {
        await timeout(_generationInitialWaitLength);
        button = await page.$x(_currentGptModeButtonSelector);
    }
}

async function waitForGenerationToComplete() {
    // console.log("enter generation waiter");
    let button;
    let waitCount = 0;
    // sometimes our query doesn't "take" quickly, and the regenerate button from the last time around stays. This waits until that is done.
    button = await page.$x(_regenButtonXPathSelector);
    if (button && button.length > 0) {
        // console.log("first generation wait loop");
        while (button && button.length > 0) {
            // console.log("first generation inner loop, button:", button);
            await timeout(_generationInitialWaitLength);
            button = await page.$x(_regenButtonXPathSelector); 
        }
    }
    await timeout(_generationWaitStepLength / 2);

    // this just waits until the next regenerate button (which appears at the end of AI output) appears. If continue does so too, we press that and wait until done.
    while (waitCount < _maxWaitCount) {
        // console.log(`second generation wait loop : ${waitCount} / ${_maxWaitCount}`);
        await timeout(_generationWaitStepLength);
        button = await page.$x(_regenButtonXPathSelector);
        if (button.length > 0) {
            await timeout(_generationWaitStepLength);
            let continueButton = await page.$x(_continueButtonXPathSelector);
            if (continueButton.length > 0) {
                // TODO: Should this reset waitCount? Adverse behavior?
                waitCount = 0;
                continueButton[0].click();
            } else {
                break;
            }
        }
        waitCount++;
    }
}

async function waitForImageToComplete() {
    let button;
    let waitCount = 0;

    // Initial delay to allow for generation to start
    await timeout(_generationInitialWaitLength);

    // Wait until download button appears or timeout
    while (waitCount < _maxWaitCount) {
        await timeout(_generationWaitStepLength);
        button = await page.$x(_downloadButtonXPathSelector);
        
        if (button.length > 0) {
            // Found download button, image is ready
            break;
        }
        
        // Check for continue button in case of long generations
        let continueButton = await page.$x(_continueButtonXPathSelector);
        if (continueButton.length > 0) {
            waitCount = 0;
            continueButton[0].click();
        }
        
        waitCount++;
    }

    // Final small delay to ensure image is fully loaded
    await timeout(_generationWaitStepLength);
}

async function getGptList() {
    let gptList = await page.$x(_gptSelectorButtons);
    let list = [];

    list.push("GPT-4");
    list.push("GPT-3.5");
    for (const gpt of gptList) {
        const text = await page.evaluate(element => element.textContent, gpt);
        if (text == "ChatGPTChatGPT") {
            continue;
        } else {
            list.push(text.trim());
        }
    }

    return list;
}

async function newChat(modelName) {
    // backwards compatibility:
    // console.log(`new chat model name: ${modelName}`);
    if (modelName == "4" || modelName == 4) {
        modelName = "GPT-4";
    }
    if (modelName == "3" || modelName == 3) {
        modelName = "GPT-3.5";
    }
    // console.log(`new chat modified model name: ${modelName}`);
    if (modelName == "GPT-4" || modelName == "GPT-3.5") {
        // go through the chatgpt button -> chatgpt selector -> appropriate gpt model
        // console.log(`new chat gpt 4 or 3.5 detected`);
        let clickResponse = await clickButton(_indexedGptSelectorButtonSelectorStub + "2]");
        if (clickResponse === -1) {
            console.error("Error: cannot click top chatgpt button for new chat");
            return clickResponse;
        }
        // console.log(`in new chatgpt`);
        await waitForNewChat();
        clickResponse = clickButton(_currentGptModeButtonSelector);
        if (clickResponse === -1) {
            console.error("Error: cannot click gpt selector dropdown menu");
            return clickResponse;
        }
        // console.log(`dropdown dropped`);
        await timeout(500);
        if (modelName == "GPT-4") {
            clickResponse = clickButton(_gptFourChatModeSelector);
            if (clickResponse === -1) {
                console.error("Error: cannot click gpt-4 button in the dropdown gpt selector menu");
                return clickResponse;
            }
        } else {
            clickResponse = clickButton(_gptThreeChatModeSelector);
            if (clickResponse === -1) {
                console.error("Error: cannot click gpt-4 button in the dropdown gpt selector menu");
                return clickResponse;
            }
        }
        // console.log(`selected from dropdown`);
    } else {
        // e.g. //div[@class='pb-0.5 last:pb-0' and @data-projection-id!='98' and contains(., "Hot Mods")] works
        const gptSelector = _gptSelectorButtonStub + `contains(., "${modelName}")]`;
        console.log(gptSelector);
        const clickResponse = await clickButton(gptSelector);
        if (clickResponse === -1) {
            console.error("Error: cannot click gpt button for new chat");
            return clickResponse;
        }
        await waitForNewChat();
        return 0;
    }
}

async function retry() {
    let innerHTML;
    const buttonXPathSelector = _regenButtonXPathSelector;
    const clickResponse = await clickButton(buttonXPathSelector);
    if (clickResponse === -1) {
        return clickResponse;
    }
    // TODO: I think in case of errors that need regeneration, they disable the input box. Wait and see.
    await waitForGenerationToComplete();
    innerHTML = await readLastResponse();
    return innerHTML;
}

async function queryAi(message, context) {
    let queryString;
    let innerHTML = '';
    if (context === "") {
        queryString = message + "\n";
    } else {
        queryString = message + "\n WITH THE BELOW CONTEXT: \n" + context + "\n";
    }
    const inputSelector = "TextArea";
    const answerSelector = "div .markdown";

    await page.waitForSelector(inputSelector);
    await page.focus(inputSelector);
    await type(queryString);
    // Add two newlines to trigger the send
    await type("\n");
    await type("\n");
    
    await waitForGenerationToComplete();
    
    innerHTML += await getInnerHtmlOfLastElem(answerSelector);
    return innerHTML;
}

async function saveCookies() {
    const cookies = await page.cookies();
    // Save cookies to a file
    try {
        fs.writeFileSync('./cookies.json', JSON.stringify(cookies, null, 2));
    } catch (e) {
        console.error(e);
    }
}

async function genImage(text) {
    const inputSelector = "TextArea";
    
    // Wait for and focus the input
    await page.waitForSelector(inputSelector);
    await page.focus(inputSelector);
    
    // Type the text and send
    await type(text);
    await type("\n");
    await type("\n");
    
    // Wait for image generation to complete
    await waitForImageToComplete();
    
    // Find the image element (it appears right before the download button)
    const downloadButton = await page.$x(_downloadButtonXPathSelector);
    if (downloadButton.length === 0) {
        throw new Error("Download button not found after generation");
    }
    
    // Get the image element with opacity 1 (the fully visible one)
    const imageElement = await page.evaluateHandle(button => {
        // First, find the main image container which is a sibling of the button's container
        const buttonContainer = button.closest('.flex');
        const imageContainer = buttonContainer.previousElementSibling;
        
        // Find all images and get the one with opacity 1 (the fully visible one)
        const images = imageContainer.querySelectorAll('img');
        for (const img of images) {
            if (img.style.opacity === '1') {
                return img;
            }
        }
        
        // Fallback to first image if no opacity 1 image found
        return images[0];
    }, downloadButton[0]);
    
    if (!imageElement) {
        throw new Error("Image element not found");
    }
    
    // Get image source
    const imageSrc = await page.evaluate(img => img.src, imageElement);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${process.env.HOME}/Desktop/chatgpt-image-${timestamp}.png`;
    
    // Download the image
    const viewSource = await page.goto(imageSrc);
    const buffer = await viewSource.buffer();
    fs.writeFileSync(filename, buffer);
    
    // Go back to chat
    await page.goBack();
    
    return filename;
}

async function uploadImage(imagePath) {
    console.log("Starting image upload process...");
    
    try {
        // Find the contenteditable div that serves as the input
        console.log("Looking for contenteditable input...");
        const inputSelector = "#prompt-textarea";
        await page.waitForSelector(inputSelector, { visible: true, timeout: 10000 });
        
        // Read the file content
        console.log("Reading file content:", imagePath);
        const fileContent = fs.readFileSync(imagePath);
        const fileName = imagePath.split('/').pop();
        
        // Determine file type based on extension
        let fileType = 'application/octet-stream';
        if (fileName.endsWith('.png')) fileType = 'image/png';
        else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) fileType = 'image/jpeg';
        else if (fileName.endsWith('.gif')) fileType = 'image/gif';
        
        // Convert file content to array buffer for transfer to browser context
        const fileArray = [...new Uint8Array(fileContent)];
        
        // Do everything in a single page.evaluate to avoid context issues
        console.log("Creating file and triggering paste event...");
        const success = await page.evaluate(async (inputSelector, fileName, fileArray, fileType) => {
            try {
                // Find the contenteditable element
                const contentEditable = document.querySelector(inputSelector);
                if (!contentEditable) {
                    console.error("Contenteditable input not found");
                    return false;
                }
                
                // Create a File object from the array buffer
                const file = new File(
                    [new Uint8Array(fileArray).buffer],
                    fileName,
                    { type: fileType }
                );
                
                // Create a DataTransfer object
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                
                // Focus the contentEditable element
                contentEditable.focus();
                
                // Create and dispatch paste event
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                });
                
                // Dispatch the event
                console.log("Dispatching paste event with file:", fileName);
                contentEditable.dispatchEvent(pasteEvent);
                
                return true;
            } catch (error) {
                console.error("Error in browser context:", error.message);
                return false;
            }
        }, inputSelector, fileName, fileArray, fileType);
        
        if (!success) {
            throw new Error("Failed to paste file into input");
        }
        
        // Wait for image to be uploaded and visible
        console.log("Waiting for image to complete...");
        const uploadIndicatorSelector = 'circle.origin-[50%_50%] -rotate-90 stroke-gray-400';
        try {
            // First check if the upload indicator appears
            await page.waitForSelector(uploadIndicatorSelector, { timeout: 10000 });
            console.log("Upload in progress: circular indicator detected");
            
            // Then wait for it to disappear, which indicates the upload is complete
            await page.waitForFunction(
                (selector) => !document.querySelector(selector),
                { timeout: 30000 },
                uploadIndicatorSelector
            );
            console.log("Upload circle disappeared: image upload completed");
        } catch (err) {
            console.log("Upload indicator not found or disappeared quickly, continuing...");
        }
        
        console.log("Image upload complete!");
        return true;
    } catch (error) {
        console.error("Error during file upload:", error);
        throw error;
    }
}

module.exports = { startBrowser, visitPage, closeBrowser, type, selectElem, 
    selectElemWithIndex, writeInTextArea, getInnerHtmlOfLastElem,
    queryAi, retry, saveCookies, newChat, loadOlderChats, getGptList, getChatList, goToChat, waitForImageToComplete, genImage, uploadImage};
