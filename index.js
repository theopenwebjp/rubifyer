/**
 * @returns {Dictionary}
 */
function Dictionary() {
    return {
        characters: [],
        words: []
    }
}

const DEFAULT_SETTINGS = {
    /**
     * Candidates.
     * @type {DictionaryOption[]}
     */
    dictionaries: [],
    /**
     * Current dictionary state.
     */
    dictionary: Dictionary(),
    format: "object",
    serialization: "json",
    formatConstants: {
        FULL: "full",
        OBJECT: "object",
        SINGLE: "single"
    },
    serializationConstants: {
        JSON: "json",
        STRING: "string"
    }
};

/**
 * @param {RubifyerOptions} [options]
 * @return {typeof DEFAULT_SETTINGS}
 */
function Settings(options = {}) {
    return Object.assign(DEFAULT_SETTINGS, options)
}

/**
 * @typedef {Object} Dictionary
 * @property {CharacterInfo[]} characters All character are deemed kanji for now.
 * @property {WordInfo[]} words
 */

/**
 * @typedef {Partial<RubifyerSettings>} RubifyerOptions
 * @typedef {typeof DEFAULT_SETTINGS} RubifyerSettings
 * @typedef {(Dictionary|string)} DictionaryOption
 * @typedef {{ char: string }} CharacterInfo
 * @typedef {{ str: string, ruby: string }} WordInfo
 */

export default class Rubifyer {
    /**
     * @param {RubifyerOptions} [options]
     */
    constructor(options = {}) {
        this.constants = {
            RUBY_ELEMENT_ATTRIBUTE: '__RUBY_ELEMENT', // The created ruby element. Not necessarily a ruby element. Can just be a wrapper.
            RUBIFIED_ELEMENT_ATTRIBUTE: '__RUBIFIED_ELEMENT', // The element that has had a ruby element added to it.
            OLD_TEXT_CONTENT_ATTRIBUTE: '__OLD_TEXT_CONTENT', // For storing textContent if changed. Can be used to revert changes.
            OLD_HTML_ATTRIBUTE: '__OLD_INNER_HTML' // For storing innerHTML if changed. Can be used to revert changes.
        }
        this.selectors = {
            RUBY_ELEMENT: `[${this.constants.RUBY_ELEMENT_ATTRIBUTE}]`,
            RUBIFIED_ELEMENT: `[${this.constants.RUBIFIED_ELEMENT_ATTRIBUTE}]`
        }

        this.settings = Settings(options)
        this.loaded = false
        this.loadingPromise = this.setup().then(() => {
            this.loaded = true
        })
    }

    /**
     * @public
     */
    awaitLoad() {
        return this.loadingPromise
    }

    /**
     * @public
     * @param {{ topElement?: Element|Document }} [options]
     */
    rubifyPage(options = {}) {
        this.getAllRenderableElements(options.topElement).forEach(el => this.rubifyElement(el))
    }

    /**
     * @public
     * @param {{ topElement?: Element|Document }} [options]
     */
    derubifyPage(options = {}) {
        Array.from((options.topElement || document).querySelectorAll('*')).forEach(el => this.derubifyElement(el))
        // this.getAllRenderableElements(options.topElement).forEach(el => this.derubifyElement(el))
    }

    /**
     * @public
     * @param {RubifyerSettings} settings 
     */
    async applySettings(settings) {
        await Promise.all(settings.dictionaries.map(d => this.loadDictionary(d)))
    }
    
    /**
     * @public
     */
    clearSettings() {
        this.settings = Settings()
    }

    /**
     * MUST NOT re-rubify. Multiple-rubifying leads to multi-line rubification AND slows down browser in certain circumstances.
     * @public
     * @param {HTMLElement} element 
     */
     rubifyElement(element) {
        const text = element.textContent;
        
        // Only process normal elements
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        
        // Node black list of renderable(non-renderable are blocked beforehand).
        const BLACK_LIST = [
            'ruby', 'rb', 'rt', // Ruby
        ]
        if (BLACK_LIST.includes(element.tagName.toLowerCase())) {
            return false;
        }

        // Invalid parents including self
        const BLACK_LISTED_PARENTS = [
            // 'pre'
        ]
        if (
            BLACK_LISTED_PARENTS.map(
                t => element.tagName.toLowerCase() === t || element.closest(t)
            ).length > 0
        ){
            return false;
        }
        
        // Only process text elements
        if (!text) {
            return false;
        }

        // No re-rubify
        if ([
            !!element.querySelector('rb'),
            element.hasAttribute(this.constants.RUBIFIED_ELEMENT_ATTRIBUTE)
        ].includes(true)) {
            return false;
        }
        
        const REQUIRE_CHANGE = true;
        const rubifiedTextEl = this.getRubifiedStringAsElement(text, REQUIRE_CHANGE);
        
        // Clear and append
        if (rubifiedTextEl) {

            // Store old(support revert if desired)
            element.setAttribute(this.constants.OLD_TEXT_CONTENT_ATTRIBUTE, element.textContent || '')
            element.setAttribute(this.constants.OLD_HTML_ATTRIBUTE, element.innerHTML)

            // Updates
            element.setAttribute(this.constants.RUBIFIED_ELEMENT_ATTRIBUTE, '')
            element.innerHTML = "";
            element.appendChild(rubifiedTextEl);
        }
    }

    /**
     * Removes any direct ruby elements.
     * This includes:
     * 1. Any added through this library.
     * 2. Any meeting the following format: <CUR_ELEMENT><ruby>...</ruby></CUR_ELEMENT>
     * @public
     * @param {HTMLElement} element
     */
    derubifyElement(element) {
        
        // 1
        if (element.hasAttribute(this.constants.RUBIFIED_ELEMENT_ATTRIBUTE)) {
            element.innerHTML = element.getAttribute(this.constants.OLD_HTML_ATTRIBUTE) || ''

            // Remove meta
            element.removeAttribute(this.constants.OLD_HTML_ATTRIBUTE)
            element.removeAttribute(this.constants.OLD_TEXT_CONTENT_ATTRIBUTE)
            element.removeAttribute(this.constants.RUBIFIED_ELEMENT_ATTRIBUTE)
            element.removeAttribute(this.constants.RUBY_ELEMENT_ATTRIBUTE)
        }

        // 2
        else if (Array.from(element.children).filter(el => el.tagName.toLowerCase() === 'ruby')) {
            Array.from(element.children).forEach(el => {
                if (el.tagName.toLowerCase() === 'ruby') {
                    element.removeChild(el)
                }
            })
        }
    }

    /**
     * @public
     * @param {string} str 
     * @param {boolean} requireChange 
     */
    getRubifiedStringAsElement(str, requireChange) {
        /**
         * @param {string} str
         */
        const condition = (str) => {
            return this.isKanji(str);
        };
        let match = null;
        let lastFoundMatch = null;
        let lastIndex = 0;
        let index = 0;
        
        const element = document.createElement("span");
        element.setAttribute(this.constants.RUBY_ELEMENT_ATTRIBUTE, '')
        
        while(match = getNextContinuousStringMatch(str, condition, index)){
            
            // console.log("match", match);
            
            // This state
            lastFoundMatch = match;
            index = match.index;
            
            // Normal before text
            const normalText = str.substr(lastIndex, (index - lastIndex));
            if(index >= lastIndex && normalText){
                element.appendChild(getNormalStringAsElement(normalText));
            }
            
            // Rubify
            const rubyText = this.getWordRuby(match.string);
            const rubyEl = rubify(match.string, rubyText);
            element.appendChild(rubyEl);
            
            // Last and next State
            lastIndex = index;
            index = match.nextIndex;
            
            // console.log("last index: ", index);
        }
        
        // Allow null response
        if (requireChange && !lastFoundMatch) {
            return lastFoundMatch;
        }
        
        // Normal after text
        const normalText = str.substr(index);
        if (normalText) {
            element.appendChild(getNormalStringAsElement(normalText));
        }
        
        return element;
    }

    /**
     * @private
     */
     async setup() {
        if (this.loaded) {
            return
        }
        await this.applySettings(this.settings)
    }

    /**
     * @private
     * @param {DictionaryOption} dictionaryOption
     */
     async loadDictionary(dictionaryOption) {
        /**
         * @type {Dictionary}
         */
        const data = typeof dictionaryOption === 'string' ? await (await fetch(dictionaryOption)).json() : dictionaryOption

        this.loadKanjiList(data.characters, this.settings.format, this.settings.serialization);
        this.loadWordList(data.words, this.settings.format, this.settings.serialization);
    }

    /**
     * @private
     * @param {string | any[]} data
     * @param {string} format
     * @param {string} serialization
     */
    loadKanjiList(data, format, serialization){
        const def = {char: ""};
        const singleKey = "char";
        this.settings.dictionary.characters = this.getCommonDataList(data, format, serialization, def, singleKey);
        return this.settings.dictionary.characters;
    }

    /**
     * @private
     * @param {string | any[]} data
     * @param {string} format
     * @param {string} serialization
     */
    loadWordList(data, format, serialization){
        const def = {str: "", ruby: ""};
        const singleKey = "str";
        this.settings.dictionary.words = this.getCommonDataList(data, format, serialization, def, singleKey);
        return this.settings.dictionary.words;
    }

    /**
     * @private
     * @param {string | any[]} data
     * @param {string} format
     * @param {string} serialization
     * @param {{ char?: string; str?: string; ruby?: string; }} def
     * @param {string} singleKey
     */
    getCommonDataList(data, format, serialization, def, singleKey){
        if (!format) {
            format = this.settings.format;
        }
        if (!serialization) {
            serialization = this.settings.serialization;
        }
        const list = [];
        
        const arr = (serialization === this.settings.serializationConstants.STRING) ? JSON.parse(data) : data
        
        for (var i=0; i<arr.length; i++) {
            let item = arr[i];
            
            if (format === this.settings.formatConstants.FULL) {
                item = item;
            } else if (format === this.settings.formatConstants.OBJECT) {
                item = item;
            } else if (format === this.settings.formatConstants.SINGLE) {
                const obj = cloneObject(def);
                obj[singleKey] = item;
            }
            
            list.push(item);
        }
        
        return list;
    }

    /**
     * @private
     * @param {Element|Document} [topElement]
     */
    getAllRenderableElements(topElement = document) {
        /*
        SPEC:
        
        Renderable elements are of node type TEXT.
        Return elements must be full element with text element inside.
        */
        
        const disallowedElements = ["script", "style", "meta"];
        const elements = topElement.getElementsByTagName("*");

        /**
         * @type {Element[]}
         */
        const rElements = [];
        
        for (let i=0; i<elements.length; i++) {
            const element = elements[i];
            
            // Only allow elements with 1 text node
            if (element.childNodes.length !== 1 || element.childNodes[0].nodeType !== Node.TEXT_NODE) {
                continue;
            }
            
            // Only allow non script/style/meta elements(Should be rendered)
            if (disallowedElements.indexOf(element.tagName.toLowerCase()) >= 0) {
                continue;
            }
            
            rElements.push(element);
        }
        
        return rElements;
    }

    /**
     * @private
     * @param {string} char 
     */
    isKanji(char){
        const charInfo = this.getCharInfo(char);
        if (charInfo) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @private
     * @param {string} str 
     */
    getWordRuby(str){
        const wordInfo = this.getWordInfo(str);
        if (wordInfo && wordInfo.ruby) {
            return wordInfo.ruby;
        } else {
            return "";
        }
    }

    /**
     * @private
     * @param {string} str 
     */
    getWordInfo(str){
        const words = this.getWords();
        for (let i=0; i<words.length; i++) {
            if (words[i].str === str) {
                return words[i];
            }
        }
        
        return null;
    }

    /**
     * @private
     * @param {string} char 
     */
    getCharInfo(char) {
        const chars = this.getChars();
        for (let i=0; i<chars.length; i++) {
            if (chars[i].char === char) {
                return chars[i];
            }
        }
        
        return null;
    }

    /**
     * @private
     */
    getChars() {
        return this.settings.dictionary.characters;
    }

    /**
     * @private
     */
    getWords() {
        return this.settings.dictionary.words;
    }
}

/**
 * Creates ruby element from rubify options.
 * @param {string} str
 * @param {string} rubyStr
 */
 function rubify(str, rubyStr) {
    /*
    SPEC:
    
    Correct: <ruby><rb>String</rb><rt>Ruby String</rt></ruby>
    Tested state: <ruby><rt>Ruby Before</rt>String<rt>Ruby Above</rt><rt>Ruby After</rt></ruby>
    
    Return: Ruby element
    */
    
    // Elements
    const ruby = document.createElement("ruby");
    const rb = document.createElement("rb");
    const rt = document.createElement("rt");
    
    // Text
    rb.textContent = str;
    rt.textContent = rubyStr;
    
    // Append
    ruby.appendChild(rb);
    ruby.appendChild(rt);
    
    return ruby;
}

/**
 * @param {Object} obj
 */
function cloneObject(obj) {
    return Object.assign({}, obj);
}

/**
 * @param {string} str 
 */
function getNormalStringAsElement(str) {
    const spanEl = document.createElement("span");
    spanEl.textContent = str;
    
    return spanEl;
}

function StringMatch() {
    const match = {
        index: -1,
        nextIndex: -1,
        string: ""
    };
    return match
}

/**
 * 
 * @param {string} str 
 * @param {function(string):boolean} condition 
 * @param {number} startIndex 
 */
function getNextContinuousStringMatch(str, condition, startIndex) {
    
    // console.log("string: ", str);
    const match = StringMatch()
    
    let index = 0;
    if (startIndex) {
        index = startIndex;
    }
    
    for (;index<str.length; index++) {
        
        // Found
        if (condition(str[index])) {
            // console.log("found char match: ", str[index], index, match.index);
            
            // Start index
            if(match.index < 0) {
                match.index = index;
            }
            
            match.string+= str[index];
        }
        
        // Found and ended(early exit)
        else {
            if (match.index >= 0) {
                break;
            }
        }
    }
    
    // Match found
    if (match.index >= 0) {
        match.nextIndex = match.index + match.string.length;
        return match;
    }
    
    // Failed/End
    else {
        return false;
    }
}
