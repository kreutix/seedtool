// mnemonics is populated as required by getLanguage
// const mnemonics = { english: new Mnemonic('english') };
// const mnemonic = mnemonics['english'];
let seed = null;
let bip32RootKey = null;
let bip32ExtendedKey = null;
// let network = bitcoin.networks.bitcoin;
let wordList = [];
let showIndex = true;
let showAddress = true;
let showPubKey = true;
let showPrivKey = true;
let showQr = false;

let entropyTypeAutoDetect = true;
let entropyChangeTimeoutEvent = null;
let phraseChangeTimeoutEvent = null;
let seedChangedTimeoutEvent = null;
let rootKeyChangedTimeoutEvent = null;

const generationProcesses = [];
/**
 * Setup the DOM for interaction
 */
const DOM = {};
const setupDom = () => {
  DOM.accordionButtons = document.querySelectorAll('.accordion');
  DOM.accordionPanels = document.querySelectorAll('.panel');
  DOM.allTabContents = document.querySelectorAll('.tabContent');
  DOM.allTabLinks = document.querySelectorAll('.tabLinks');
  DOM.generateRandomStrengthSelect = document.getElementById(
    'generateRandomStrength'
  );
  DOM.generateButton = document.querySelector('.btn.generate');
  DOM.bip32RootKey = document.getElementById('bip32RootKey');
  // DOM.knownInputTextarea = document.getElementById('knownInputTextarea');
  DOM.entropyFilterWarning = document.getElementById('entropy-discarded-chars');
  DOM.entropyDisplay = document.querySelector('input[id="entropyDetails"]');
  DOM.entropyInput = document.getElementById('entropy');
  DOM.toastMessage = document.getElementById('toast');
  DOM.entropyTimeToCrack = document.getElementById('entropyTimeToCrack');
  DOM.entropyEventCount = document.getElementById('entropyEventCount');
  DOM.entropyEntropyType = document.getElementById('entropyEntropyType');
  DOM.entropyBitsPerEvent = document.getElementById('entropyBitsPerEvent');
  DOM.entropyRawWords = document.getElementById('entropyRawWords');
  DOM.entropyTotalBits = document.getElementById('entropyTotalBits');
  DOM.entropyFiltered = document.getElementById('entropyFiltered');
  DOM.entropyRawBinary = document.getElementById('entropyRawBinary');
  DOM.entropyBinaryChecksum = document.getElementById('entropyBinaryChecksum');
  DOM.entropyWordIndexes = document.getElementById('entropyWordIndexes');
  DOM.entropyMnemonicLengthSelect = document.getElementById(
    'entropyMnemonicLength'
  );
  DOM.entropyPBKDF2Rounds = document.getElementById('entropyPBKDF2Rounds');
  DOM.pbkdf2CustomInput = document.getElementById('pbkdf2CustomInput');
  DOM.entropyMethod = document.getElementById('entropyMethod');
  DOM.bip39Phrase = document.getElementById('bip39Phrase');
  DOM.bip39PhraseWarn = document.querySelector('.bip39-invalid-phrase');
  DOM.bip39PhraseSplit = document.getElementById('bip39PhraseSplit');
  DOM.bip39PhraseSplitWarn = document.getElementById('bip39PhraseSplitWarn');
  DOM.bip39ShowSplitMnemonic = document.getElementById(
    'bip39ShowSplitMnemonic'
  );
  DOM.bip39Passphrase = document.getElementById('bip39Passphrase');
  DOM.bip39Seed = document.getElementById('bip39Seed');
  DOM.bip44Coin = document.getElementById('bip44Coin');
  DOM.bip44Account = document.getElementById('bip44Account');
  DOM.bip44Change = document.getElementById('bip44Change');
  DOM.bip44AccountXprv = document.getElementById('bip44AccountXprv');
  DOM.bip44AccountXpub = document.getElementById('bip44AccountXpub');
  DOM.bip44Path = document.getElementById('bip44Path');
  DOM.bip85Application = document.getElementById('bip85Application');
  DOM.bip85MnemonicLength = document.getElementById('bip85MnemonicLength');
  DOM.bip85Bytes = document.getElementById('bip85Bytes');
  DOM.bip85Index = document.getElementById('bip85Index');
  DOM.bip85ChildKey = document.getElementById('bip85ChildKey');

  // Accordion Sections
  DOM.accordionButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      btn.classList.toggle('accordion--active');
      const panel = btn.nextElementSibling;
      panel.classList.toggle('accordion-panel--active');
      adjustPanelHeight();
    });
  });
  // FOOTER: calculate copyright year
  document.querySelectorAll('.cYear').forEach((yearSpan) => {
    let output = '';
    const currentYear = new Date().getFullYear();
    const originYear = parseInt(yearSpan.innerHTML);
    if (currentYear - originYear > 10) {
      output = '&nbsp;-&nbsp;' + originYear + 10;
    } else if (currentYear !== originYear) {
      output = '&nbsp;-&nbsp;' + currentYear;
    }
    yearSpan.innerHTML += output;
  });
  // Make sure that the generate seed tab is open
  document.getElementById('defaultOpenTab').click();
  // Setup one click copy
  document.querySelectorAll('.one-click-copy').forEach((textElement) => {
    textElement.addEventListener('click', (event) => {
      event.preventDefault();
      const text = textElement.innerText || textElement.value;
      copyTextToClipboard(text);
    });
  });
  // add template for derived addresses
  addDerivedAddressBlocks();
  // add listener for bip44 path inputs
  DOM.bip44Coin.addEventListener('change', changeBip44Path);
  DOM.bip44Account.addEventListener('change', changeBip44Path);
  DOM.bip44Change.addEventListener('change', changeBip44Path);
  // Add event listener for displaying/hiding entropy details
  DOM.entropyDisplay.addEventListener('click', () => {
    displayEntropy(DOM.entropyDisplay.checked);
  });
  // add event listener for entropy
  DOM.entropyInput.oninput = calculateEntropy;
  // add event listener for new mnemonic / passphrase
  DOM.bip39Passphrase.oninput = mnemonicToSeedPopulate;
  DOM.bip39Phrase.oninput = mnemonicToSeedPopulate;
  // Add event listener to generate new mnemonic
  DOM.generateButton.addEventListener('click', generateNewMnemonic);
  // Generate random seed words
  DOM.generateButton.click();
  // update pointer to word list
  wordList = bip39.wordlists[Object.keys(bip39.wordlists)[0]];
  // add fake csv for testing
  // injectAddresses(testAddressData, 'bip47');
  // injectAddresses(testAddressData, 'bip49');
  // injectAddresses(testAddressData, 'bip84');
};

// Run setupDom function when the page has loaded
window.addEventListener('DOMContentLoaded', setupDom);

function getAddress(node, network) {
  return bitcoin.payments.p2pkh({ pubkey: node.publicKey, network }).address;
}

/**
 * Debounce - from Underscore.js
 * @param {function} func The function to debounce
 * @param {number} wait Number of ms to wait
 * @param {boolean} immediate Override timeout and call now
 * @returns {function}
 */
// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// Event handler for switching tabs
window.tabSelect = (event, tabId) => {
  DOM.allTabContents.forEach((contentElement) => {
    contentElement.style.display = 'none';
  });
  DOM.allTabLinks.forEach((tabLink) => {
    tabLink.classList.remove('tab--active');
  });
  document.getElementById(tabId).style.display = 'block';
  event.currentTarget.classList.add('tab--active');
  adjustPanelHeight();
};
/**
 * QnA Explains dialog / Modal
 */
DOM.infoModal = document.getElementById('infoModal');
DOM.infoModalText = document.getElementById('infoModalText');
/**
 * Hide the modal and clear it's text
 */
const clearInfoModal = () => {
  DOM.infoModal.style.display = 'none';
  DOM.infoModalText.innerHTML = '';
};
/**
 * Open the QnA Explains dialog
 * @param {Event} _event Not used
 * @param {string} section string for the key to get value from info.js
 */
window.openInfoModal = (_event, section) => {
  DOM.infoModalText.innerHTML = window.infoHtml[section];
  DOM.infoModal.style.display = 'block';
};
/**
 * Function to close the dialog when user clicks on the outside
 * @param {Event} event Click Event on area outside the dialog
 */
window.onclick = function (event) {
  if (event.target == DOM.infoModal) {
    clearInfoModal();
  }
};
/**
 * If navigator.clipboard is not available, here is fallback
 * @param {string} text text to copy
 */
function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    let msg = successful ? 'successful' : 'unsuccessful';
    console.log('Fallback: Copying text command was ' + msg);
    toast('Copied to clipboard');
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    toast('ERROR: Unable to copy to clipboard');
  }

  document.body.removeChild(textArea);
}
/**
 * Copy text to clipboard
 * @param {string} text text to copy
 */
function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
  } else {
    navigator.clipboard.writeText(text).then(
      function () {
        console.log('Async: Copying to clipboard was successful!');
        toast('Copied to clipboard');
      },
      function (err) {
        console.error('Async: Could not copy text: ', err);
        toast('ERROR: Unable to copy to clipboard');
      }
    );
  }
}
/**
 * Displays a pop-up message like a notification
 * @param {string} message Message to display in notification toast
 */
function toast(message) {
  DOM.toastMessage.innerText = message || 'ERROR: Unknown Message';
  DOM.toastMessage.classList.add('show-toast');
  const background = document.getElementById('toast-background');
  background.classList.add('show-toast');
  setTimeout(() => {
    DOM.toastMessage.classList.remove('show-toast');
    background.classList.remove('show-toast');
  }, 3000);
}
/**
 * Display / Hide Entropy details
 * @param {boolean} checked Is the checkbox checked
 */
function displayEntropy(checked) {
  DOM.entropyDetailsContainer = document.getElementById(
    'entropyDetailsContainer'
  );
  if (checked) {
    // show details
    DOM.entropyDetailsContainer.style.display = 'flex';
  } else {
    DOM.entropyDetailsContainer.style.display = 'none';
  }
  adjustPanelHeight();
}
/**
 * Whenever some CSS changes in an accordion panel, call this to fix the panel
 */
function adjustPanelHeight() {
  DOM.accordionPanels.forEach((panel) => {
    const isActive = panel.classList.contains('accordion-panel--active');
    if (isActive) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    } else {
      panel.style.maxHeight = null;
    }
  });
}

const changeBip44Path = () => {
  const coin = DOM.bip44Coin.value;
  const account = DOM.bip44Account.value;
  const change = DOM.bip44Change.value;
  const path = `m/44'/${coin}'/${account}'/${change}`;
  DOM.bip44Path.value = path;
};
/**
 * Add derived address blocks to each section
 */
const addDerivedAddressBlocks = () => {
  const bips = ['bip32', 'bip44', 'bip47', 'bip49', 'bip84'];
  // Ensure not internet explorer!
  if (!('content' in document.createElement('template'))) {
    throw new Error(
      'Browser Outdated! Unable to populate address list and generate csv.'
    );
  }
  bips.forEach((bip) => {
    const container = document.querySelector('.derived-addresses-block-' + bip);
    const template = document.querySelector('#derivedAddressTemplate');
    const clone = template.content.firstElementChild.cloneNode(true);
    if (!container || !template || !clone) {
      console.error('Unable to insert Address block template for ' + bip);
      return;
    }
    const gen = clone.querySelector('button');
    gen.id = bip + 'GenerateBtn';
    gen.addEventListener('click', generateAddresses);
    const a = clone.querySelector('a');
    a.className = bip + '-csv-download-link';
    a.download = bip + '_addresses.csv';
    a.classList.add('hidden');
    clone
      .querySelector('.address-display-content')
      .classList.add(bip + '-address-display-content--list');
    container.appendChild(clone);
  });
};
/**
 * Class representing address data
 * Used to populate address lists
 */
class AddressData {
  /**
   * Create an AddressData object.
   * @param {string} path - The path used to generate the address.
   * @param {string} address - The address.
   * @param {string} pubKey - The public key.
   * @param {string} prvKey - The private key.
   */
  constructor(path, address, pubKey, prvKey) {
    this.path = path;
    this.address = address;
    this.pubKey = pubKey;
    this.prvKey = prvKey;
  }
}
/**
 * Injects address data into the assigned address list
 * @param {AddressData[]} addressDataArray - an array of AddressData objects.
 * @param {string} addressListName - a string saying which address list to populate. e.g. 'bip32'
 */
const injectAddresses = (addressDataArray, addressListName) => {
  // Init the csv string with the headers
  let csv = `path,address,public key,private key
`;
  // declare DOM elements
  const a = document.querySelector(`.${addressListName}-csv-download-link`);
  a.classList.remove('hidden');
  const listContainer = document.querySelector(
    `.${addressListName}-address-display-content--list`
  );
  const template = document.querySelector('#addressTemplate');
  // check we have the DOM elements
  if (!listContainer || !template || !a) {
    throw new Error(
      'Address container not found! Unable to populate list and generate csv.'
    );
  }
  // Ensure not internet explorer!
  if (!('content' in document.createElement('template'))) {
    throw new Error(
      'Browser Outdated! Unable to populate list and generate csv.'
    );
  }
  addressDataArray.forEach((addressData) => {
    // Append this address to csv
    csv += `${addressData.path},${addressData.address},${addressData.pubKey},${addressData.prvKey},
`;
    // clone the address list template HTML
    const clone = template.content.firstElementChild.cloneNode(true);
    // Insert the path, address, public key & private key into the clone
    for (const data in addressData) {
      if (Object.hasOwnProperty.call(addressData, data)) {
        clone.querySelector(`.address-details--${data}`).innerText =
          addressData[data];
      }
    }
    // Add the clone to the DOM
    listContainer.appendChild(clone);
    adjustPanelHeight();
  });
  a.href = `data:text/csv;charset=utf-8,${encodeURI(csv)}`;
};

const calculateAddresses = (bip, startIndex = 0, endIndex = 19) => {
  clearAddresses(bip);
  if (!bip32RootKey) {
    console.error('Unable to generate addresses while bip32RootKey is null');
    return;
  }
  const node = bip32RootKey;
  // console.log(seed);
  // if (!seed) {
  //   return;
  // }
  const path = {
    bip32: () => `m/0'/0'/`,
    bip44: () => DOM.bip44Path.value + '/',
    bip47: () => false,
    bip49: () => false,
    bip84: () => false,
    bip85: () => false,
    bip141: () => false,
  };
  if (!path[bip]()) {
    console.error('Unable to generate addresses without valid path');
    return;
  }
  // const node = bip32.fromSeed(seed);
  const addressDataArray = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const addressPath = path[bip]() + i + `'`;
    const addressNode = node.derivePath(addressPath);
    const address = getAddress(addressNode);
    const addressPubKey = addressNode.publicKey.toString('hex');
    const addressPrivKey = bitcoin.ECPair.fromPrivateKey(
      addressNode.privateKey
    ).toWIF();
    addressDataArray[i] = new AddressData(
      addressPath,
      address,
      addressPubKey,
      addressPrivKey
    );
  }
  injectAddresses(addressDataArray, bip);
};

const generateAddresses = (event) => {
  event.preventDefault();
  const btn = event.target;
  const parentEl = btn.parentElement;
  const startIndex =
    parseInt(parentEl.querySelector('.address-start-index')?.value) || 0;
  const endIndex =
    parseInt(parentEl.querySelector('.address-end-index')?.value) || 19;
  const bip = btn.id.replace('GenerateBtn', '');
  calculateAddresses(bip, startIndex, endIndex);
};

const clearAddresses = (bip) => {
  const a = document.querySelector(`.${bip}-csv-download-link`);
  a.classList.add('hidden');
  const listContainer = document.querySelector(
    `.${bip}-address-display-content--list`
  );
  while (listContainer.firstChild) {
    listContainer.removeChild(listContainer.firstChild);
  }
  adjustPanelHeight();
};

const calculateEntropy = () => {
  const unknown = 'Unknown';
  const entropy = window.Entropy.fromString(DOM.entropyInput.value);
  const numberOfBits = entropy.binaryStr.length;
  const wordCount = Math.floor(numberOfBits / 32) * 3;
  const bitsPerEvent = entropy.bitsPerEvent?.toFixed(2) || unknown;
  const spacedBinaryStr = entropy.binaryStr
    ? addSpacesEveryElevenBits(entropy.binaryStr)
    : unknown;
  let timeToCrack = unknown;
  try {
    const z = window.zxcvbn(entropy.base.events.join(''));
    timeToCrack = z.crack_times_display.offline_fast_hashing_1e10_per_second;
    if (z.feedback.warning != '') {
      timeToCrack = timeToCrack + ' - ' + z.feedback.warning;
    }
  } catch (e) {
    console.log('Error detecting entropy strength with zxcvbn:');
    console.log(e);
  }

  //
  DOM.entropyTimeToCrack.innerText = timeToCrack;
  DOM.entropyEventCount.innerText = entropy.base.events.length;
  DOM.entropyEntropyType.innerText = getEntropyTypeStr(entropy);
  DOM.entropyBitsPerEvent.innerText = bitsPerEvent;
  DOM.entropyRawWords.innerText = wordCount;
  DOM.entropyTotalBits.innerText = numberOfBits;
  DOM.entropyFiltered.innerText = entropy.cleanHtml;
  DOM.entropyRawBinary.innerText = spacedBinaryStr;
  DOM.entropyBinaryChecksum.innerText = '... TODO ';
  // document.getElementById('entropyTimeToCrack').innerText = '... TODO ';
  // document.getElementById('entropyTimeToCrack').innerText = '... TODO ';
  // document.getElementById('entropyTimeToCrack').innerText = '... TODO ';
  // document.getElementById('entropyTimeToCrack').innerText = '... TODO ';
  // document.getElementById('entropyTimeToCrack').innerText = '... TODO ';
  // document.getElementById('entropyTimeToCrack').innerText = '... TODO ';
  // detect and warn of filtering
  const rawNoSpaces = DOM.entropyInput.value.replace(/\s/g, '');
  const cleanNoSpaces = entropy.cleanStr.replace(/\s/g, '');
  const isFiltered = rawNoSpaces.length !== cleanNoSpaces.length;
  if (isFiltered) {
    DOM.entropyFilterWarning.classList.remove('hidden');
  } else {
    DOM.entropyFilterWarning.classList.add('hidden');
  }
};

const getEntropyTypeStr = (entropy) => {
  let typeStr = entropy.base.str || 'Unknown';
  // Add some detail if these are cards
  if (entropy.base.asInt == 52 && entropy.binaryStr) {
    const cardDetail = []; // array of message strings
    // Detect duplicates
    const dupes = [];
    const dupeTracker = {};
    entropy.base.events.forEach((card) => {
      const cardUpper = card.toUpperCase();
      if (cardUpper in dupeTracker) {
        dupes.push(card);
      }
      dupeTracker[cardUpper] = true;
    });
    if (dupes.length > 0) {
      const dupeWord = dupes.length === 1 ? 'duplicate' : 'duplicates';
      let msg = `${dupes.length} ${dupeWord}: ${dupes.slice(0, 3).join(' ')}`;
      if (dupes.length > 3) {
        msg += '...';
      }
      cardDetail.push(msg);
    }
    // Detect full deck
    const uniqueCards = [];
    for (const uniqueCard in dupeTracker) {
      uniqueCards.push(uniqueCard);
    }
    if (uniqueCards.length == 52) {
      cardDetail.unshift('full deck');
    }
    // Detect missing cards
    /* cSpell:disable */
    const values = 'A23456789TJQK';
    const suits = 'CDHS';
    /* cSpell:ensable */
    const missingCards = [];
    suits.forEach((suit) => {
      values.forEach((value) => {
        const card = value + suit;
        if (!(card in dupeTracker)) {
          missingCards.push(card);
        }
      });
    });
    // Display missing cards if six or less, ie clearly going for full deck
    if (missingCards.length > 0 && missingCards.length <= 6) {
      let msg = `${missingCards.length} missing: ${missingCards
        .slice(0, 3)
        .join(' ')}`;
      if (missingCards.length > 3) {
        msg += '...';
      }
      cardDetail.push(msg);
    }
    // Add card details to typeStr
    if (cardDetail.length > 0) {
      typeStr += ` (${cardDetail.join(', ')})`;
    }
  }
  return typeStr;
};
/**
 * Adds a space every eleven bits
 * @param {string} binaryStr - Binary string
 * @returns {string}
 */
const addSpacesEveryElevenBits = (binaryStr) =>
  binaryStr.match(/.{1,11}/g).join(' ');

const showWordIndexes = () => {
  var phrase = DOM.phrase.val();
  var words = phraseToWordArray(phrase);
  var wordIndexes = [];
  var language = getLanguage();
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    var wordIndex = WORDLISTS[language].indexOf(word);
    wordIndexes.push(wordIndex);
  }
  var wordIndexesStr = wordIndexes.join(', ');
  DOM.entropyWordIndexes.text(wordIndexesStr);
};

function showChecksum() {
  var phrase = DOM.phrase.val();
  var words = phraseToWordArray(phrase);
  var checksumBitlength = words.length / 3;
  var checksum = '';
  var binaryStr = '';
  var language = getLanguage();
  for (var i = words.length - 1; i >= 0; i--) {
    var word = words[i];
    var wordIndex = WORDLISTS[language].indexOf(word);
    var wordBinary = wordIndex.toString(2);
    while (wordBinary.length < 11) {
      wordBinary = '0' + wordBinary;
    }
    var binaryStr = wordBinary + binaryStr;
    if (binaryStr.length >= checksumBitlength) {
      var start = binaryStr.length - checksumBitlength;
      var end = binaryStr.length;
      checksum = binaryStr.substring(start, end);
      // add spaces so the last group is 11 bits, not the first
      checksum = checksum.split('').reverse().join('');
      checksum = addSpacesEveryElevenBits(checksum);
      checksum = checksum.split('').reverse().join('');
      break;
    }
  }
  DOM.entropyChecksum.text(checksum);
}

const generateNewMnemonic = () => {
  toast('Calculating...');
  const numWords = parseInt(DOM.generateRandomStrengthSelect.value);
  const strength = (numWords / 3) * 32;
  const mnemonic = bip39.generateMnemonic(strength);
  DOM.bip39Phrase.value = mnemonic;
  // DOM.knownInputTextarea.value = mnemonic;
  mnemonicToSeedPopulate();
};

/**
 * Called when mnemonic is updated
 */
const mnemonicToSeedPopulate = debounce(() => {
  const mnemonic = DOM.bip39Phrase.value;
  const passphrase = DOM.bip39Passphrase.value || '';
  let seedHex = '';
  resetEverything();
  seed = null;
  // Test if valid
  if (bip39.validateMnemonic(mnemonic)) {
    DOM.bip39PhraseWarn.classList.add('hidden');
    seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
    seedHex = seed.toString('hex');
  } else {
    DOM.bip39PhraseWarn.classList.remove('hidden');
  }
  DOM.bip39Seed.value = seedHex;
  DOM.entropyInput.value = seedHex;
  calculateEntropy();
  if (seed) {
    const node = bip32.fromSeed(seed);
    bip32RootKey = node;
  } else {
    bip32RootKey = null;
  }
  DOM.bip32RootKey.value = bip32RootKey ? bip32RootKey.toBase58() : 'unknown';
}, 1000);

const resetEverything = () => {
  seed = null;
  bip32RootKey = null;
  DOM.bip32RootKey.value = '';
  DOM.entropyInput.value = '';
  DOM.entropyTimeToCrack.innerText = '...';
  DOM.entropyEventCount.innerText = '...';
  DOM.entropyEntropyType.innerText = '...';
  DOM.entropyBitsPerEvent.innerText = '...';
  DOM.entropyRawWords.innerText = '...';
  DOM.entropyTotalBits.innerText = '...';
  DOM.entropyFiltered.innerText = '...';
  DOM.entropyRawBinary.innerText = '...';
  DOM.entropyBinaryChecksum.innerText = '...';
  DOM.entropyWordIndexes.innerText = '...';
  DOM.entropyMnemonicLengthSelect.value = '12';
  DOM.entropyPBKDF2Rounds.value = '2048';
  DOM.pbkdf2CustomInput.value = '2048';
  DOM.entropyMethod.value = 'binary';
  DOM.bip39PhraseSplit.value = '';
  DOM.bip39ShowSplitMnemonic.checked = false;
  DOM.bip39Seed.value = '';
  DOM.bip44AccountXprv.value = '';
  DOM.bip44AccountXpub.value = '';
  DOM.bip85Application.value = 'bip39';
  DOM.bip85MnemonicLength.value = '12';
  DOM.bip85Bytes.value = '64';
  DOM.bip85Index.value = '0';
  DOM.bip85ChildKey.value = '';
  ['bip32', 'bip44'].forEach((bip) => clearAddresses(bip));
};
