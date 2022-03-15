# Description

Simple library for rubifying(Add ruby characters/tags) the page.
Goal is to simply get mapped ruby characters from API and display for words in current page.

## Usage

```js
import Rubifyer from './index.js'

const dictionary = './dictionary.json' // URL
// const dictionary = { "characters": [ { "char": "完" }, { "char": "璧" } ], "words": [ { "str": "完璧", "ruby": "カンペキ" } ] } // OBJECT
const rubifyer = new Rubifyer({ dictionaries: [dictionary] }) // Partial<RubifyerSettings>
rubifyer.awaitLoad().then(async () => {

    /*
    // RubifyerSettings:
    {
        dictionaries: [],
        dictionary: {},
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
    }
    */ 

    rubifyer.rubifyPage({ topElement: document })
    rubifyer.derubifyPage({ topElement: document })
    await rubifyer.applySettings(settings) // RubifyerSettings
    rubifyer.clearSettings()
    rubifyer.rubifyElement(element)
    rubifyer.derubifyElement(element)
})
```

## Test

```bash
npx http-server ./
# http://localhost:8080
```

## Localization

- [日本語](./README_JA.md)
