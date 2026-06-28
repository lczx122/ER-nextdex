import { loadFont } from "./fonts.js"


const appName = "ERdex"
const appSettings = appName + "_settings"
const settingsVersion = "9" //when changed it will init newly added elements from default to the current settings
// and this automatically to prevent some undefined behavior
const themeList =  [
    "blueish",
    "rushed",
    "wood",
    "blahaj",
]
// Light / dark appearance (the new design system). "auto" follows the OS.
const modeList = ['light', 'dark', 'auto']
const fontList = [
    'clean',
    'basis33',
    'Inconsolata',
    'Determination',
]
export const settings = {

}

const defaultSettings = {
    settingsVersion: settingsVersion,
    theme: "blueish",
    mode: "light",
    storageEnable: true,
    monotype: false,
    discordFormat: true,
    font: "clean",
    hintSelectible: true
}

export function initAppSettings(){
    if (!window.localStorage.getItem(appSettings)){
        //default settings
        Object.assign(settings, defaultSettings)
        saveSettings()
    } else {
        Object.assign(settings, JSON.parse(window.localStorage.getItem(appSettings)))
        if (settings.settingsVersion !== settingsVersion){
            console.log('readapted the settings')
            for (const newSettings in defaultSettings){
                if (settings[newSettings] == undefined){
                    settings[newSettings] = defaultSettings[newSettings]
                }
            }
            // Upgrade anyone still on the old default bitmap font (or an unknown
            // font) to the new readable default.
            if (settings.font === 'basis33' || !fontList.includes(settings.font)){
                settings.font = defaultSettings.font
            }
            settings.settingsVersion = settingsVersion
            saveSettings()
        }
    }
    changeTheme()
    applyMode(settings.mode)
    loadFont(settings.font)
}

/**
 * Apply the light/dark appearance by setting data-theme on <html>. "auto"
 * resolves to the OS preference and tracks live changes.
 */
let _modeMediaBound = false
export function applyMode(mode){
    if (modeList.indexOf(mode) === -1) mode = 'light'
    const resolve = (m) => m === 'auto'
        ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : m
    document.documentElement.setAttribute('data-theme', resolve(mode))
    if (mode === 'auto' && window.matchMedia && !_modeMediaBound){
        _modeMediaBound = true
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (settings.mode === 'auto'){
                document.documentElement.setAttribute('data-theme', resolve('auto'))
                syncThemeColorMeta()
            }
        })
    }
    syncThemeColorMeta()
}

export function saveSettings(){
    try{
        if (window.localStorage) window.localStorage.setItem(appSettings, JSON.stringify(settings))
    }
    catch(e){
        alert("couldn't save settings, report to the dev if this message appear")
    }
}

export function saveToLocalstorage(key, value){
    //disabled fetch from local storage if it does not support it
    if (typeof window.localStorage === 'undefined') return undefined
    if (typeof value === "object"){
        try{
            window.localStorage.setItem(appName + key, JSON.stringify(value))
        }
        catch(e){
            cleanLocalStorage()
        }
    } else {
        try{
            window.localStorage.setItem(appName + key, value)
        } catch(_e){
            // no localstorage for ou i guess
        }
        
    }
}

export function fetchFromLocalstorage(key){
    try {
        //disabled fetch from local storage if it does not support it
        if (typeof window.localStorage === 'undefined') return undefined
        const returnedValue = window.localStorage.getItem(appName + key)
        // sometimes it's "null" stringified, which is very fun
        return returnedValue === "null" || returnedValue === null ? undefined : returnedValue
    } catch(_e){
        return undefined
    }
    
}

function changeTheme(){
    let settingsTheme = settings.theme
    if (themeList.indexOf(settingsTheme) == -1) settingsTheme = themeList[0]
    for (const theme of themeList){
        document.getElementById(`styles-${theme}`).disabled = theme !== settingsTheme
    }
    syncThemeColorMeta()
}

/**
 * Keep the browser/PWA UI colour (status bar, task switcher) in sync with the
 * active theme by reflecting its --background onto <meta name="theme-color">.
 */
function syncThemeColorMeta(){
    const meta = document.getElementById('meta-theme-color')
    if (!meta) return
    const bg = getComputedStyle(document.documentElement)
        .getPropertyValue('--background').trim()
    if (bg) meta.setAttribute('content', bg)
}
function toUpperCaseFirst(word){
    return word.charAt(0).toUpperCase() + word.slice(1)
}
function setDynamicalRowOfSettings(name, settingsList, onchange){
    const Name = toUpperCaseFirst(name)
    const frag = document.createDocumentFragment()
    const rowCore = document.createElement('div')
    rowCore.className = 'settings-row'
    const themeSpan = document.createElement('span')
    themeSpan.innerText =  Name + ":"
    frag.append(themeSpan)
    for (let i = 0 ; i < settingsList.length ; i++){
        const settingsItem = settingsList[i]
        const label = document.createElement('label')
        label.innerText = toUpperCaseFirst(settingsItem)
        label.htmlFor = `${name}-${settingsItem}`
        const input = document.createElement('input')
        input.type = "radio"
        input.name = name
        input.id = `${name}-${settingsItem}`
        if (settings[name] === settingsItem) input.checked = true
        input.onchange = ()=>{onchange(settingsItem, i)}
        frag.append(label)
        frag.append(input)
    }
    rowCore.append(frag)
    $('#settings-main').after(rowCore)
}
export function getHintInteractibilityClass(isForRegular = true){
    if (!isForRegular){ // it's for filter then, the main use of this function
        return settings.hintSelectible ? "filter-interactible" : "filter-interactible-disable"
    }
    return settings.hintSelectible ? "interactible" : "interactible-disable"
}
export function setupSettings(){
    $('#settings-btn').on('click', function(){
        $('#settings-frame').toggle()
    })
    $('#settings-close').on('click', function(){
        $('#settings-frame').hide()
    })
    $('#settings-btn').on('mouseover', function(){
        $(this).attr('src', './icons/settings_hover.png')
    })
    $('#settings-btn').on('mouseleave', function(){
        $(this).attr('src', './icons/settings.png')
    })
    $('#disable-storage').on('change', ()=>{
        settings.storageEnable = false
        saveSettings()
    })
    $('#enable-storage').on('change', ()=>{
        settings.storageEnable = true
        saveSettings()
    })
    if (!settings.storageEnable) $('#disable-storage').attr('checked', true)
    $('#enable-monotype').on('change', ()=>{
        settings.monotype = true
        saveSettings()
    })
    $('#disable-monotype').on('change', ()=>{
        settings.monotype = false
        saveSettings()
    })
    if (settings.monotype) $('#enable-monotype').attr('checked', true)
    $('#enable-export-discord').on('change', ()=>{
        settings.discordFormat = true
        saveSettings()
    })
    $('#disable-export-discord').on('change', ()=>{
        settings.discordFormat = false
        saveSettings()
    })
    if (settings.discordFormat) $('#enable-export-discord').attr('checked', true)
    function setHintInteractible(){
        const isEnabled = settings.hintSelectible
        const targetClass = isEnabled ? ".interactible-disable" : ".interactible"
        $(targetClass).toggleClass('interactible-disable', !isEnabled).toggleClass('interactible', isEnabled)
        const targetClassFilter = isEnabled ? ".filter-interactible-disable" : ".filter-interactible"
        $(targetClassFilter).toggleClass('filter-interactible-disable', !isEnabled).toggleClass('filter-interactible', isEnabled)
    }
    $('#enable-interactible').on('change', ()=>{
        settings.hintSelectible = true
        setHintInteractible()
        saveSettings()
    })
    $('#disable-interactible').on('change', ()=>{
        settings.hintSelectible = false
        setHintInteractible()
        saveSettings()
    })
    if (settings.hintSelectible) $('#enable-interactible').attr('checked', true)
    setHintInteractible()
    setDynamicalRowOfSettings("font", fontList, (font)=>{
        settings.font = font
        saveSettings()
        loadFont(font)
    })
    if (settings.discordFormat) $('#enable-export-discord').attr('checked', true)
    setDynamicalRowOfSettings("mode", modeList, (mode) => {
        settings.mode = mode
        saveSettings()
        applyMode(mode)
    })
}

/**
 * when the localStorage is too full
 */
function cleanLocalStorage(){
    if (!localStorage) return // dunno
    console.log('cleaned the local storage of data')
    const keys = Object.keys(localStorage) 
    for (const key of keys){
        //only delete the part that are about ER dex
        if (key.indexOf("ERdex") == -1) continue
        // only delete the data
        if (key.indexOf("ERdexdata") == -1) continue
        localStorage.removeItem(key)
    }
}