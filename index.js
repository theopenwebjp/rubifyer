var settings = {
    dataUrl: null,
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

var dictionary = {// TODO: Indexing and make sure loaded is unique
    characters: [//All character are deemed kanji for now.
        {
            char: "完"
        },
        {
            char: "璧"
        }
    ],
    words: [
        {
            str: "完璧",
            ruby: "カンペキ"
        }
    ]
};

export async function setup(){
    const data = dictionary // TODO: Should use settings.dataUrl in future.

    loadKanjiList(data.characters, settings.format, settings.serialization);
    loadWordList(data.words, settings.format, settings.serialization);
}

export function rubifyPage() {
    rubifyAllElements();
}

/**
 * @param {string | any[]} data
 * @param {string} format
 * @param {string} serialization
 */
function loadKanjiList(data, format, serialization){
    var def = {char: ""};
    var singleKey = "char";
    dictionary.characters = getCommonDataList(data, format, serialization, def, singleKey);
    return dictionary.characters;
}

/**
 * @param {string | any[]} data
 * @param {string} format
 * @param {string} serialization
 */
function loadWordList(data, format, serialization){
    var def = {str: "", ruby: ""};
    var singleKey = "str";
    dictionary.words = getCommonDataList(data, format, serialization, def, singleKey);
    return dictionary.words;
}

/**
 * @param {string | any[]} data
 * @param {string} format
 * @param {string} serialization
 * @param {{ char?: string; str?: string; ruby?: string; }} def
 * @param {string} singleKey
 */
function getCommonDataList(data, format, serialization, def, singleKey){
    if(!format){
        format = settings.format;
    }
    if(!serialization){
        serialization = settings.serialization;
    }
    var arr = [];
    var list = [];
    var item;
    var obj;
    
    if(serialization === settings.serializationConstants.STRING){
        arr = JSON.parse(data);
    }else{
        arr = data;
    }
    
    for(var i=0; i<arr.length; i++){
        item = arr[i];
        
        if(format === settings.formatConstants.FULL){
            item = item;
        }else if(format === settings.formatConstants.OBJECT){
            item = item;
        }else if(format === settings.formatConstants.SINGLE){
            obj = cloneObject(def);
            obj[singleKey] = item;
        }
        
        list.push(item);
    }
    
    return list;
}

/**
 * @param {Object} obj
 */
function cloneObject(obj){
    return Object.assign({}, obj);
}

/**
 * @param {string} str
 * @param {string} rubyStr
 */
function rubify(str, rubyStr){
    /*
    SPEC:
    
    Correct: <ruby><rb>String</rb><rt>Ruby String</rt></ruby>
    Tested state: <ruby><rt>Ruby Before</rt>String<rt>Ruby Above</rt><rt>Ruby After</rt></ruby>
    
    Return: Ruby element
    */
    
    //Elements
    var ruby = document.createElement("ruby");
    var rb = document.createElement("rb");
    var rt = document.createElement("rt");
    
    //Text
    rb.textContent = str;
    rt.textContent = rubyStr;
    
    //Append
    ruby.appendChild(rb);
    ruby.appendChild(rt);
    
    return ruby;
}

function getAllRenderableElements(){
    /*
    SPEC:
    
    Renderable elements are of node type TEXT.
    Return elements must be full element with text element inside.
    */
    
    var disallowedElements = ["script", "style", "meta"];
    var elements = document.getElementsByTagName("*");
    var element;
    var rElements = [];
    
    for(var i=0; i<elements.length; i++){
        element = elements[i];
        
        //Only allow elements with 1 text node
        if(element.childNodes.length !== 1 || element.childNodes[0].nodeType !== Node.TEXT_NODE){
            continue;
        }
        
        //Only allow non script/style/meta elements(Should be rendered)
        if(disallowedElements.indexOf(element.tagName.toLowerCase()) >= 0){
            continue;
        }
        
        rElements.push(element);
    }
    
    return rElements;
}

function rubifyAllElements(){
    var elements = getAllRenderableElements();
    console.log("elements", elements);
    for(var i=0; i<elements.length; i++){
        rubifyElement(elements[i]);
    }
}

/**
 * @param {HTMLElement} element 
 */
function rubifyElement(element){
    var text = element.textContent;
    
    //Only process normal elements
    if(element.nodeType !== Node.ELEMENT_NODE){
        return false;
    }
    
    //Only process text elements
    if(!text){
        return false;
    }
    
    var REQUIRE_CHANGE = true;
    var rubifiedTextEl = getRubifiedStringAsElement(text, REQUIRE_CHANGE);
    
    //Clear and append
    if(rubifiedTextEl){
        element.innerHTML = "";
        element.appendChild(rubifiedTextEl);
    }
}

/**
 * @param {string} str 
 * @param {boolean} requireChange 
 */
function getRubifiedStringAsElement(str, requireChange){
    var condition = function(str){
        return isKanji(str);
    };
    var match = null;
    var lastFoundMatch = null;
    var rubyText;
    var normalText;
    var lastIndex = 0;
    var index = 0;
    
    var element = document.createElement("span");
    var rubyEl;
    
    while(match = getNextContinuousStringMatch(str, condition, index)){
        
        console.log("match", match);
        
        //This state
        lastFoundMatch = match;
        index = match.index;
        
        //Normal before text
        normalText = str.substr(lastIndex, (index - lastIndex));
        if(index >= lastIndex && normalText){
            element.appendChild(getNormalStringAsElement(normalText));
        }
        
        //Rubify
        rubyText = getWordRuby(match.string);
        rubyEl = rubify(match.string, rubyText);
        element.appendChild(rubyEl);
        
        //Last and next State
        lastIndex = index;
        index = match.nextIndex;
        
        console.log("last index: ", index);
    }
    
    //Allow null response
    if(requireChange && !lastFoundMatch){
        return lastFoundMatch;
    }
    
    //Normal after text
    normalText = str.substr(index);
    if(normalText){
        element.appendChild(getNormalStringAsElement(normalText));
    }
    
    return element;
}

/**
 * @param {string} str 
 */
function getNormalStringAsElement(str){
    var spanEl = document.createElement("span");
    spanEl.textContent = str;
    
    return spanEl;
}

/**
 * 
 * @param {string} str 
 * @param {function(string):boolean} condition 
 * @param {number} startIndex 
 */
function getNextContinuousStringMatch(str, condition, startIndex){
    
    console.log("string: ", str);
    
    var match = {
        index: -1,
        nextIndex: -1,
        string: ""
    };
    
    var index = 0;
    if(startIndex){
        index = startIndex;
    }
    
    for(;index<str.length; index++){
        
        //Found
        if(condition(str[index])){
            console.log("found char match: ", str[index], index, match.index);
            
            //Start index
            if(match.index < 0){
                match.index = index;
            }
            
            match.string+= str[index];
        }
        
        //Found and ended(early exit)
        else{
            if(match.index >= 0){
                break;
            }
        }
    }
    
    //Match found
    if(match.index >= 0){
        match.nextIndex = match.index + match.string.length;
        return match;
    }
    
    //Failed/End
    else{
        return false;
    }
}

/**
 * @param {string} char 
 */
function isKanji(char){
    var charInfo = getCharInfo(char);
    if(charInfo){
        return true;
    }else{
        return false;
    }
}

/**
 * @param {string} str 
 */
function getWordRuby(str){
    var wordInfo = getWordInfo(str);
    if(wordInfo && wordInfo.ruby){
        return wordInfo.ruby;
    }else{
        return "";
    }
}

/**
 * @param {string} str 
 */
function getWordInfo(str){
    var words = getWords();
    for(var i=0; i<words.length; i++){
        if(words[i].str === str){
            return words[i];
        }
    }
    
    return null;
}

/**
 * @param {string} char 
 */
function getCharInfo(char){
    var chars = getChars();
    for(var i=0; i<chars.length; i++){
        if(chars[i].char === char){
            return chars[i];
        }
    }
    
    return null;
}

function getChars(){
    return dictionary.characters;
}

function getWords(){
    return dictionary.words;
}