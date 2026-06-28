import { redirectLocation } from "../locations_panel.js"
import { matchedMoves, moveOverlay } from "../moves_panel.js"
import { addTooltip, capitalizeFirstLetter, AisInB, e, JSHAC, reorderNodeList } from "../../utils.js"
import { search } from "../../search.js"
import { queryFilter2, longClickToFilter, queryFilter3 } from "../../filters.js"
import { gameData, compareData } from "../../data_version.js"
import { createInformationWindow, removeInformationWindow } from "../../window.js"
import { getDefensiveCoverage, abilitiesToAddedType} from "../../weakness.js"
import { nodeLists } from "../../hydrate/hydrate.js"
import { cubicRadial } from "../../radial.js"
import { getHintInteractibilityClass, settings } from "../../settings.js"
import { feedCommunitySets } from "./community_sets.js"

export let currentSpecieID = 1

const spriteAlternateFunc = [
    getSpritesURL,
    getSpritesShinyURL,
    getBackSpritesURL,
    getBackSpritesShinyURL,
]

export function feedPanelSpecies(id) {
    currentSpecieID = id
    const specie = gameData.species[id]
    $('#species-name').text(`${specie.name}#${specie.dex.id || "??"}`)
    $('#species-id').text(`ID: ${specie.id}`)
    updateBaseStats(specie.stats.base)
    if (specie.shinyColor === undefined)
        specie.shinyColor = 0
    $('#species-front').attr('src', spriteAlternateFunc[specie.shinyColor](specie.NAME))
    $('#species-front')[0].onclick = () => {
        if (specie.shinyColor === undefined)
            specie.shinyColor = 0
        specie.shinyColor = ++specie.shinyColor % spriteAlternateFunc.length
        $('#species-front').attr('src', spriteAlternateFunc[specie.shinyColor](specie.NAME))
    }
    
    $('#species-front')[0].dataset.shiny = "off"
    setAbilities(specie.stats.abis, specie)
    setInnates(specie.stats.inns)
    specie.activeAbi = 0
    const potentialThirdType = abilitiesExtraType(specie.activeAbi, specie)
    // do not add a third type if the mon already had it
    if (potentialThirdType && ! specie.stats.types.find(x => x === potentialThirdType)){
        specie.thirdType = potentialThirdType
    }
    setTypes([...new Set(specie.stats.types), specie.thirdType], specie)
    setAllMoves(specie)
    setEvos(specie.evolutions)
    setLocations(specie.locations, specie.SEnc)
    $('#species-desc').text(specie.dex.desc)
    setSpecieHeightWeight()
    setSpecieColor()
    $('#species-list').find('.sel-active').addClass("sel-n-active").removeClass("sel-active")
    nodeLists.species[id - 1].classList.replace("sel-n-active", "sel-active")

    feedCommunitySets(specie.NAME)
}

export function redirectSpecie(specieId) {
    if ($("#btn-species")[0].classList.contains("btn-active")) {
        $(nodeLists.species[specieId - 1]).click()[0].scrollIntoView({ behavior: "smooth" })
    } else {
        search.callbackAfterFilters = () => {
            $(nodeLists.species[specieId - 1]).click()[0].scrollIntoView({ behavior: "smooth" })
        }
        $("#btn-species").click()
    }
}

let freedom = false
function setSpecieHeightWeight(){
    const specie = gameData.species[currentSpecieID]
    const height = freedom ? `${((specie.dex?.hw?.[0] / 10) * 3.28).toFixed(2)} ft` : `${(specie.dex?.hw?.[0] / 10).toFixed(2)} m`
    const weight = freedom ? `${((specie.dex?.hw?.[1] / 10) * 2.2).toFixed(2)} lb` : `${(specie.dex?.hw?.[1] / 10).toFixed(2)} kg`
    $('#species-height').text(height)
    $('#species-weight').text(weight)
}

function setSpecieColor(){
    const specie = gameData.species[currentSpecieID]
    const color = gameData.colT[specie.stats.col]
    $('#specie-color').text(color)
}

function setDefensiveCoverage(coverage) {
    const frag = document.createDocumentFragment()
    const multiplicators = Object.keys(coverage).sort()
    for (const mult of multiplicators) {
        const row = e("div", "species-coverage-row")
        const mulDiv = e("div", "species-coverage-mul")
        const mulSpan = e("span", "span-align", mult)
        mulDiv.append(mulSpan)
        row.append(mulDiv)
        const typeNodeList = e("div", "species-coverage-list")
        const types = coverage[mult]
        for (const type of types) {
            const colorDiv = e("div", `${type.toLowerCase()} type`)
            const divText = e("span", "span-align", type.substr(0, 5))
            colorDiv.append(divText)
            typeNodeList.append(colorDiv)
        }
        row.append(typeNodeList)
        frag.append(row)
    }

    const core = $('#species-coverage')
    core.empty()
    core.append(frag)
}

// Type → accent colour, used to tint the species hero by the mon's typing.
const TYPE_HEX = {
    normal: '#9099a1', fire: '#f1762b', water: '#4f90d9', electric: '#f3c93b',
    grass: '#5dbe62', ice: '#76d0c8', fighting: '#cf4068', poison: '#b061c6',
    ground: '#d8884a', flying: '#8aa6e6', psychic: '#f56c8a', bug: '#9fc02e',
    rock: '#c7b36a', ghost: '#6a6dc0', dragon: '#7d62e0', dark: '#5b5366',
    steel: '#7f9aa6', fairy: '#ec90c6', stellar: '#3fb8c8', mystery: '#6a6dc0',
}
function applyHeroTheme(typeNames) {
    const root = document.getElementById('species-data')
    if (!root) return
    const first = (typeNames[0] || 'normal').toLowerCase()
    const second = (typeNames[1] || typeNames[0] || 'normal').toLowerCase()
    const c1 = TYPE_HEX[first] || '#5dbe62'
    const c2 = TYPE_HEX[second] || c1
    root.style.setProperty('--t1', c1)
    root.style.setProperty('--t2', c2)
}

function setTypes(types, specie) {
    types = types.filter(x => x != undefined)
    const core = $('#species-types')
    const shownTypes = []
    for (let i = 0; i < 3; i++) {
        const type = gameData.typeT[types[i]] || ""
        const node = core.children().eq(i).children().eq(0)
        if (!type) {
            node.hide()
            continue
        }
        node.show()
        node.text(type).attr("class", `type ${type.toLowerCase()}`)
        shownTypes.push(type)
    }
    applyHeroTheme(shownTypes)
    setDefensiveCoverage(
        getDefensiveCoverage(specie, specie.activeAbi)
    )
}

export function setAllMoves(specie = gameData.species[currentSpecieID]){
    setLevelUpMoves($('#learnset'), specie.levelUpMoves, $('#learnset-title'))
    setMoves($('#tmhm'), specie.TMHMMoves, $('#tmhm-title'))
    setMoves($('#tutor'), specie.tutor, $('#tutor-title'))
    setMoves($('#eggmoves'), specie.eggMoves,$('#eggmoves-title'))
    setMoves($('#preevomoves'), specie.preevomoves || [], $('#preevomoves-title'))
    
    if ($('#eggmoves-title').css('display') === 'none' && $('#preevomoves-title').css('display') === 'none') {
        $('#eggpreevo-title').hide()
    } else {
        $('#eggpreevo-title').show()
    }
    refreshMoveCategories()
}

// ---- Move-category toggle: show one of Level-up / TM-HM / Tutor / Egg at a
// time instead of one long scroll. ----
const MOVE_CATS = [
    { key: 'learnset', row: '#learnset-title',  lists: ['#learnset'] },
    { key: 'tmhm',     row: '#tmhm-title',      lists: ['#tmhm'] },
    { key: 'tutor',    row: '#tutor-title',     lists: ['#tutor'] },
    { key: 'egg',      row: '#eggpreevo-title', lists: ['#eggmoves', '#preevomoves'] },
]
let currentMoveCat = 'learnset'

function catHasMoves(cat) {
    return cat.lists.some((sel) => $(sel).children().length > 0)
}
function showMoveCategory(key) {
    const available = MOVE_CATS.filter(catHasMoves)
    const target = MOVE_CATS.find((c) => c.key === key && catHasMoves(c)) || available[0]
    MOVE_CATS.forEach((c) => { (target && c === target) ? $(c.row).show() : $(c.row).hide() })
    if (target) currentMoveCat = target.key
    $('#mv-cat-toggle .mv-cat-btn').each(function () {
        const cat = MOVE_CATS.find((c) => c.key === this.dataset.cat)
        this.classList.toggle('mv-cat-hidden', !(cat && catHasMoves(cat)))
        this.classList.toggle('mv-cat-active', !!target && this.dataset.cat === target.key)
    })
}
function refreshMoveCategories() {
    showMoveCategory(currentMoveCat)
}
function setupMoveCategoryToggle() {
    $('#mv-cat-toggle .mv-cat-btn').on('click', function () {
        showMoveCategory(this.dataset.cat)
    })
}

function filterMoves(moveIDlist) {
    if (!matchedMoves) return moveIDlist
    return moveIDlist.map(x => matchedMoves.indexOf(x) != -1 && x).filter(x => x)
}
/**
 * @param {Object} move 
 * @returns an HTML node
 */
export function setSplitMove(move) {
    const nodeMoveSplit = document.createElement('img')
    nodeMoveSplit.src = `./icons/${gameData.splitT[move.split]}.png`
    nodeMoveSplit.className = "species-move-sprite"
    return nodeMoveSplit
}
/**
 * @param {Object} move
 * @param {number} moveID
 * @returns an HTML node
 */
export function setMoveName(move) {
    const type1 = gameData.typeT[move.types[0]].toLowerCase()
    const nodeMoveName = document.createElement('div')
    nodeMoveName.innerText = move.name
    nodeMoveName.className = `species-move-name ${type1}-t`
    return nodeMoveName
}
export function setMovePower(move){
    return e('div', 'species-move-pwr', move.pwr ? move.pwr : null)
}
/**
 * 
 * @returns an HTML node
 */
export function setMoveRow(moveID) {
    const row = document.createElement('div')
    row.className = "species-move-row"
    // Tap a move to expand its details inline (accordion) instead of a floating
    // overlay. Tap again to collapse; tapping another move moves the panel.
    row.onclick = function(){
        fastdom.mutate(() => {
            const existing = document.getElementById('species-move-detail')
            if (row.classList.contains('move-selected')) {
                row.classList.remove('move-selected')
                if (existing) existing.remove()
                return
            }
            $('#species-bot .species-move-row.move-selected').removeClass('move-selected')
            if (existing) existing.remove()
            const detail = e('div', 'sp-move-detail')
            detail.id = 'species-move-detail'
            detail.append(moveOverlay(moveID, false))
            row.after(detail)
            row.classList.add('move-selected')
        })
    }
    return row
}

function setMoves(core, moves, title) {
    core.empty()
    if (!moves.length){
        core.hide()
        title.hide()
        return
    } else {
        core.show()
        title.show()
    }
    const frag = document.createDocumentFragment()
    moves = filterMoves(moves)
    for (const moveID of moves) {
        const move = gameData.moves[moveID]
        if (!move) {
            console.warn(`unable to find move with ID ${moveID}`)
            continue
        }
        const row = setMoveRow(moveID)
        row.append(setSplitMove(move, moveID))
        row.append(setMoveName(move))
        row.append(setMovePower(move))
        frag.append(row)
    }
    core.append(frag)
}
function setLevelUpMoves(core, moves, title) {
    core.empty()
    if (!moves.length){
        core.hide()
        title.hide()
        return
    } else {
        core.show()
        title.show()
    }
    const frag = document.createDocumentFragment()
    for (const { lv: lvl, id: id } of moves) {
        if (matchedMoves && matchedMoves.indexOf(id) == -1) continue
        const move = gameData.moves[id]
        if (!move) {
            console.warn(`unable to find move with ID ${id}`)
            continue
        }
        frag.append(JSHAC([
            setMoveRow(id), [
                e('div', "species-levelup-lvl"), [e('span', null, +lvl || "Ev")],
                setSplitMove(move),
                setMoveName(move),
                setMovePower(move)
            ]
        ]))
    }
    core.append(frag)
}

function updateBaseStats(stats) {
    const baseStatsTable = [
        '#BHP',
        '#BAT',
        '#BDF',
        '#BSA',
        '#BSD',
        '#BSP',
        '#BST',
    ]
    for (const i in baseStatsTable) {
        changeBaseStat($(baseStatsTable[i]), stats[i], i, compareData?.species?.[currentSpecieID].stats?.base[i])
    }
}

export function getSpritesURL(NAME) {
    NAME = NAME.replace(/^SPECIES_/, '')
    return `./sprites/${NAME}.png`
}
export function getSpritesShinyURL(NAME) {
    NAME = NAME.replace(/^SPECIES_/, '')
    return `./sprites/${NAME}_SHINY.png`
}
export function getBackSpritesURL(NAME) {
    NAME = NAME.replace(/^SPECIES_/, '')
    return `./sprites/${NAME}_BACK.png`
}
export function getBackSpritesShinyURL(NAME) {
    NAME = NAME.replace(/^SPECIES_/, '')
    return `./sprites/${NAME}_BACK_SHINY.png`
}
function changeBaseStat(node, value, statID, cmp) {

    if (cmp && !isNaN(+cmp)){
        node.find('.stat-num').html(`${cmp}→<br>${value}`)
        node.find('.stat-num').css('font-size', '0.5em').css('width', '3em')
    } else {
        node.find('.stat-num').text(value)
        node.find('.stat-num').css('font-size', '1em').css('width', '')
    }
    
    let color = "gray"
    for (const colorMapped of [
        [gameData.speciesStats.result.min5[statID], "#ff3300"],
        [gameData.speciesStats.result.min20[statID], "#cc6600"],
        [gameData.speciesStats.result.median[statID], "#cccc00"],
        [gameData.speciesStats.result.top20[statID], "#99cc00"],
        [gameData.speciesStats.result.top5[statID], "#33cc33"],
        [256, "#0033cc"],
    ]) {
        if (value < colorMapped[0]) break
        color = colorMapped[1]
    }
    const maxValue = statID < 6 ? 255 : gameData.speciesStats.result.maxBST
    const percent = ((value / maxValue) * 100).toFixed()
    node.find('.stat-num').css('background-color', color)
    node.find('.stat-bar').css('background', `linear-gradient(to right, ${color} ${percent}%, var(--stat-track, #0000) ${percent}%)`)[0]
    node[0].animate([
        {width: "0"},
        {width: `100%`},
    ], {
        duration: 300,
        iterations: 1,
    })
}

// Show an ability/innate description in the dedicated panel (mobile-friendly,
// no hover needed) and mark the tapped chip as the one being read.
function showAbiDesc(abi, node) {
    const box = document.getElementById('species-abi-desc')
    if (box) {
        box.classList.add('show')
        box.innerHTML = ''
        box.append(e('div', 'sp-abi-desc-name', abi.name))
        box.append(e('div', 'sp-abi-desc-text', abi.desc || 'No description.'))
    }
    $('#species-abi-desc-active').removeAttr('id')
    if (node) node.id = 'species-abi-desc-active'
}

function setAbilities(abilities, specie) {
    let firstAbi = null, firstNode = null
    $('#species-abilities').empty().append(
        JSHAC(abilities.map((val, i) => {
            if (abilities[i] == abilities[i - 1] || abilities[i] === 0) {
                return undefined
            }
            const abi = gameData.abilities[abilities[i]]
            const name = e("div", "species-ability " + getHintInteractibilityClass(), abi.name)
            name.onclick = () => {
                $('#species-abilities .sel-active').removeClass('sel-active').addClass('sel-n-active')
                name.classList.replace('sel-n-active', 'sel-active')
                specie.activeAbi = i
                setTypes([...new Set(specie.stats.types, abilitiesExtraType(specie.activeAbi, specie))], specie)
                showAbiDesc(abi, name)
            }
            name.classList.add(i ? "sel-n-active" : "sel-active")
            longClickToFilter(0, name, "ability", () => { return abi.name })
            if (!firstAbi) { firstAbi = abi; firstNode = name }
            return name
        }).filter(x => x))
    )
    // Show the first ability's description by default.
    if (firstAbi) showAbiDesc(firstAbi, firstNode)
}

function setInnates(innates) {
    $('#species-innates').empty().append(
        JSHAC(innates.map((val, i) => {
            if (innates[i] == innates[i - 1] || innates[i] === 0) {
                return
            }
            const inn = gameData.abilities[innates[i]]
            const name = e("div", "species-innate " + getHintInteractibilityClass(), inn.name)
            longClickToFilter(0, name, "ability", () => { return inn.name }, 0)
            name.onclick = () => showAbiDesc(inn, name)
            return name
        }).filter(x => x))
    )
}

export function abilitiesExtraType(abilityID, specie) {
    if (abilityID == false) return abilitiesToAddedType(specie.stats.inns.filter(x => x))
    return abilitiesToAddedType([specie.stats.abis[abilityID], ...specie.stats.inns].filter(x => x))
}

export function setupSpeciesPanel() {
    const subPanelsAndBtns = [
        ["#switch-moves", "#species-moves"],
        ["#switch-evos-locs", "#species-evos-locs"],
        ["#switch-misc", "#species-misc"],
        ["#switch-sets", "#species-sets"],
    ]
    subPanelsAndBtns.forEach((x) => {
        $(x[0]).on('click', () => {
            $(x[0]).parent().find('.sel-active').addClass('sel-n-active').removeClass('sel-active')
            $(x[0]).addClass('sel-active').removeClass('sel-n-active')
            $("#species-bot").find('.active-sub-panel').removeClass('active-sub-panel').hide()
            $(x[1]).addClass('active-sub-panel').show()
        })
    })
    $('#species-basestats, #species-coverage').on('click', function () {
        $('#species-basestats, #species-coverage').toggle()
    })
    $('#species-types').children().each((index, val) => {
        longClickToFilter(0, val, "type")
    })
    $('#species-hw').on('click', ()=>{
        freedom = !freedom
        setSpecieHeightWeight()
    })
    setupMoveCategoryToggle()
}
function toLowerButFirstCase(word) {
    word = word.toLowerCase()
    return word.charAt(0).toUpperCase() + word.slice(1);
}
function convertItemNames(word) {
    return word.replace('ITEM_', '').split('_').map(toLowerButFirstCase).join(' ')
}
function convertMoveNames(word) {
    return word.replace('MOVE_', '').split('_').map(toLowerButFirstCase).join(' ')
}
function convertSpeciesNames(word) {
    return word.replace('SPECIES_', '').split('_').map(toLowerButFirstCase).join(' ')
}
function convertMapName(word) {
    return word.replace('MAPSEC_', '').split('_').map(toLowerButFirstCase).join(' ')
}

export function setEvos(evos) {
    const frag = document.createDocumentFragment()
    for (const evo of evos) {
        if (evo.in == -1) continue //not set yet
        const node = document.createElement('div')
        node.className = "evo-parent" // i dunno how do classname it
        const intoSpecieNode = document.createElement('span')
        intoSpecieNode.className = "evo-into"
        intoSpecieNode.innerText = evo.from ? "From" : "Into "
        intoSpecieNode.appendChild(createSpeciesBlock(evo.in))
        node.append(intoSpecieNode)
        const reason = document.createElement('div')
        reason.className = "evo-reason"
        reason.innerText = setEvoReason(evo.kd, evo.rs)
        node.append(reason)
        frag.append(node)
    }
    $('#species-evos').empty().append(frag)
}

export function createSpeciesBlock(specieId) {
    //create a div, then inside an image and the species name with redirection
    const node = $("<span/>").addClass("specie-block").click(() => {
        redirectSpecie(specieId)
    })
    const specie = gameData.species[specieId]
    const img = $("<img/>").attr('src', getSpritesURL(specie.NAME))
        .addClass("sprite")
    const name = $("<span/>").html(specie.name)
    return node.append(img).append(name)[0]

}


/**
 * 
 * @param {number} kindID that is mapped into gameData evoKindT
 * @param {string} reason the whatever reason that is given
 * @returns text
 */
function setEvoReason(kindID, reason) {
    return {
        "EVO_LEVEL": `Evolves at level: ${reason}`,
        "EVO_MEGA_EVOLUTION": `Mega-evolves with ${convertItemNames(reason)}`,
        "EVO_ITEM": `Evolves with ${convertItemNames(reason)}`,
        "EVO_MOVE": `Evolves with ${convertMoveNames(reason)}`,
        "EVO_LEVEL_ATK_LT_DEF": `Evolves if Atk < def`,
        "EVO_LEVEL_ATK_GT_DEF": `Evolves if Atk > def`,
        "EVO_LEVEL_ATK_EQ_DEF": `Evolves if Atk = def`,
        "EVO_LEVEL_SILCOON": "???",
        "EVO_LEVEL_CASCOON": "???",
        "EVO_PRIMAL_REVERSION": "???",
        "EVO_ITEM_MALE": `Evolves with ${convertItemNames(reason)}`,
        "EVO_ITEM_FEMALE": `Evolves with ${convertItemNames(reason)}`,
        "EVO_LEVEL_NINJASK": "???",
        "EVO_LEVEL_SHEDINJA": "???",
        "EVO_MOVE_MEGA_EVOLUTION": `Mega-evolves with ${convertMoveNames(reason)}`,
        "EVO_LEVEL_FEMALE": `Evolves at level: ${reason} if female`,
        "EVO_LEVEL_MALE": `Evolves at level: ${reason} if male`,
        "EVO_SPECIFIC_MON_IN_PARTY": `Evolves if ${convertSpeciesNames(reason)} is in party`,
        "EVO_LEVEL_NIGHT": `Evolves at night if level ${reason}`,
        "EVO_LEVEL_DUSK": `Evolves at dusk if level ${reason}`,
        "EVO_LEVEL_DAY": `Evolves at day if level ${reason}`,
        "EVO_SPECIFIC_MAPSEC": `Evolves when level up at ${convertMapName(reason)}`
    }[gameData.evoKindT[kindID]]
}


function setLocations(locations, SEnc) {
    const frag = document.createDocumentFragment()
    for (const [locID, value] of locations) {
        const loc = gameData.locations.maps[locID]
        if (!loc) continue
        const node = document.createElement('div')
        node.className = "specie-locs"
        let locationString = `Can be found at ${gameData.mapsT[loc.id]}`

        let first = true
        for (const field of value) {
            if (first) first = false
            else {
                locationString += ` and`
            }
            locationString += ` on ${capitalizeFirstLetter(field)}`
        }
        node.innerText = locationString
        node.onclick = () => {
            redirectLocation(locID)
        }
        frag.append(node)
    }
    for (const {how, map, locaId} of SEnc) {
        const node = e('div', 'specie-locs-scripted',
            `Can be found at ${gameData.mapsT[map]} as a ${gameData.scriptedEncoutersHowT[how]}`, {
            onclick: () => {
                if (typeof locaId === "undefined") return
                redirectLocation(locaId)
                // this may not work because maps for scripted encounters aren't sync with location encounter
            }
        }) 
        frag.append(node)
    }
    $('#species-locations').empty().append(frag)
}

export function setupReorderBtn() {
    const list = $('#species-list')
    const byAlpha = (a, b) => a.name.localeCompare(b.name)
    const byStat = (statID, a, b) => a.stats.base[statID] - b.stats.base[statID]

    // Stats sort high→low by default (what people usually want).
    let descending = true

    // ---- The "Sort" pill button ----
    const btn = e('div', 'sort-btn')
    btn.append(e('span', 'sort-btn-icon', '↕'), e('span', 'sort-btn-label', 'Sort'))

    // ---- Dropdown menu (appended to <body> so the list's overflow doesn't
    // clip it; positioned under the button on open) ----
    const menu = e('div', 'sort-menu hidden')
    const dirBtn = e('div', 'sort-dir', 'High → Low')
    const head = e('div', 'sort-menu-head')
    head.append(e('span', 'sort-menu-title', 'Sort by'), dirBtn)
    menu.append(head)

    let activeOpt = null
    const setActive = (opt) => {
        if (activeOpt) activeOpt.classList.remove('sort-opt-active')
        activeOpt = opt
        opt.classList.add('sort-opt-active')
    }
    const addOpt = (label, fn, statId) => {
        const opt = e('div', 'sort-opt', label)
        if (statId !== undefined) opt.dataset.stat = statId
        opt.onclick = (ev) => {
            ev.stopPropagation()
            fn()
            setActive(opt)
            closeMenu()
        }
        menu.append(opt)
        return opt
    }

    const defaultOpt = addOpt('Dex order', () => reorderNodeList(list))
    addOpt('Name (A–Z)', () => reorderNodeList(list, byAlpha))
    const STATS = [['HP', 0], ['Attack', 1], ['Defense', 2], ['Sp. Atk', 3], ['Sp. Def', 4], ['Speed', 5], ['Total (BST)', 6]]
    for (const [label, id] of STATS) {
        addOpt(label, () => reorderNodeList(list, byStat.bind(null, id), descending ? '>' : '<'), id)
    }
    setActive(defaultOpt)

    dirBtn.onclick = (ev) => {
        ev.stopPropagation()
        descending = !descending
        dirBtn.innerText = descending ? 'High → Low' : 'Low → High'
        // re-apply immediately if a stat sort is active
        if (activeOpt && activeOpt.dataset.stat !== undefined) {
            reorderNodeList(list, byStat.bind(null, +activeOpt.dataset.stat), descending ? '>' : '<')
        }
    }

    document.body.appendChild(menu)
    function closeMenu() { menu.classList.add('hidden') }
    function openMenu() {
        const r = btn.getBoundingClientRect()
        menu.classList.remove('hidden')
        const mw = menu.offsetWidth || 200
        let left = r.left
        if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8
        menu.style.left = Math.max(8, left) + 'px'
        // open below; flip above if it would overflow the bottom
        const mh = menu.offsetHeight || 300
        menu.style.top = (r.bottom + 6 + mh > window.innerHeight ? Math.max(8, r.top - 6 - mh) : r.bottom + 6) + 'px'
    }
    btn.onclick = (ev) => {
        ev.stopPropagation()
        menu.classList.contains('hidden') ? openMenu() : closeMenu()
    }
    document.addEventListener('click', (ev) => {
        if (!menu.contains(ev.target) && ev.target !== btn) closeMenu()
    })

    return btn
}

function buildResist(specie){
    const weaknesses = getDefensiveCoverage(specie, 0)
    specie.resist = [].concat.apply([], [weaknesses["0"], weaknesses["0.25"], weaknesses["0.5"]])
        .filter(x => x)
        .map(x => x.toLowerCase())
}
function buildImmune(specie){
    const weaknesses = getDefensiveCoverage(specie, 0)
    specie.immune = [].concat.apply([], [weaknesses["0"]])
        .filter(x => x)
        .map(x => x.toLowerCase())
}
function buildWeak(specie){
    const weaknesses = getDefensiveCoverage(specie, 0)
    specie.weak = [].concat.apply([], [weaknesses["2"], weaknesses["4"], weaknesses["8"]])
        .filter(x => x)
        .map(x => x.toLowerCase())
}

const prefixTree = {
    treeId: "species"
}
export function buildSpeciesPrefixTrees(){
    prefixTree.name = {}
    prefixTree.type = {}
    gameData.species.forEach((x, i)=>{
        x.splicedName = x.name.split(' ').map(x => x.toLowerCase())
        for (const splice of x.splicedName){
            const prefix = splice.charAt(0)
            if (!prefixTree.name[prefix]) prefixTree.name[prefix] = []
            prefixTree.name[prefix].push({data: i, suggestions: x.name})
        }
        x.allTypesNames = x.stats.types.map((pokeType) => {
            const typeAsString = gameData.typeT[pokeType].toLowerCase()
            const prefix = typeAsString.charAt(0)
            if (!prefixTree.type[prefix]) prefixTree.type[prefix] = []
            prefixTree.type[prefix].push({data: i, suggestions: typeAsString})
            return typeAsString
        })
    })
}

export const queryMapSpecies = {
    "name": (queryData, specie) => {
        if (specie.name.toLowerCase() === queryData) return [true, specie.name, false]
        queryData = queryData.split(' ')
        if (!queryData.length) return false
        for (const subQueryData of queryData){
            let hasSlicedMatched = false
            for (const splice of specie.splicedName){
                hasSlicedMatched = AisInB(subQueryData, splice) || hasSlicedMatched
            }
            if (!hasSlicedMatched) return false
        }
        return specie.name
        
    },
    "type": (queryData, specie) => {
        if (settings.monotype && specie.allTypesNames[0]) {
            return AisInB(queryData, specie.allTypesNames[0]) && specie.allTypesNames[0] == specie.allTypesNames[1]
        }
        const typesQueried = queryData.split(' ').filter(x => x)
        const thirdType = specie.thirdType ? gameData.typeT[specie.thirdType].toLowerCase() : null
        let multiSuggestions = []
        for (const typeQueried of typesQueried){
            let isValid = false
            if(thirdType && AisInB(typeQueried, thirdType)) {
                multiSuggestions.push(thirdType)
                continue
            }
            for (const type of specie.allTypesNames) {
                if (AisInB(typeQueried, type)) {
                    multiSuggestions.push(type)
                    isValid = true
                    break
                }
            }
            if (!isValid) {
                return false
            }
        }
        return {multiSuggestions: multiSuggestions}
    },
    "ability": (queryData, specie) => {
        let abilities = specie.stats.abis
            .map((x) => gameData.abilities[x].name.toLowerCase())
            .concat(
                specie.stats.inns.map((x) => gameData.abilities[x].name.toLowerCase())
            )
        for (const abi of abilities) {
            if (AisInB(queryData, abi)) {
                return [abi === queryData, abi, false]
            }
        }
        return false
    },
    "move": (queryData, specie) => {
        let moves = specie.allMoves?.map((x) => gameData.moves[x].name.toLowerCase()) || []
        let isUnperfectMatch = false
        for (const move of moves) {
            if (AisInB(queryData, move)) {
                if (queryData === move) return [true, move, false]
                isUnperfectMatch = move
            }
        }
        return isUnperfectMatch
    },
    "region": (queryData, specie) => {
        const specieRegion = specie.region?.toLowerCase() || ""
        if (AisInB(queryData, specieRegion)) {
            return specie.region
        }
    },
    "resist": (queryData, specie) => {
        const typesQueried = queryData.split(' ').filter(x => x)
        let multiSuggestions = []
        for (const typeQueried of typesQueried){
            let isValid = false
            if (!specie.resist) buildResist(specie)
            for (const typeR of specie.resist){
                if (AisInB(typeQueried, typeR)) {
                    multiSuggestions.push(typeR)
                    isValid = true
                    break
                }
            }
            if (!isValid) {
                return false
            }
        }
        return {multiSuggestions: multiSuggestions}
    },
    "immune": (queryData, specie) => {
        const typesQueried = queryData.split(' ').filter(x => x)
        let multiSuggestions = []
        for (const typeQueried of typesQueried){
            let isValid = false
            if (!specie.immune) buildImmune(specie)
            for (const typeR of specie.immune){
                if (AisInB(typeQueried, typeR)) {
                    multiSuggestions.push(typeR)
                    isValid = true
                    break
                }
            }
            if (!isValid) {
                return false
            }
        }
        return {multiSuggestions: multiSuggestions}
    },
    "weak": (queryData, specie) => {
        const typesQueried = queryData.split(' ').filter(x => x)
        let multiSuggestions = []
        for (const typeQueried of typesQueried){
            let isValid = false
            if (!specie.weak) buildWeak(specie)
            for (const typeR of specie.weak){
                if (AisInB(typeQueried, typeR)) {
                    multiSuggestions.push(typeR)
                    isValid = true
                    break
                }
            }
            if (!isValid) {
                return false
            }
        }
        return {multiSuggestions: multiSuggestions}
    },
}

export let matchedSpecies = []
export function updateSpecies(searchQuery) {
    const species = gameData.species
    const matched = queryFilter3(searchQuery, species, queryMapSpecies, prefixTree)
    let validID;
    const specieLen = species.length
    for (let i = 0; i < specieLen; i++) {
        if (i == 0) continue
        const node = $(nodeLists.species[i - 1])
        if (!matched || matched.indexOf(i) != -1) {
            if (!validID) validID = i
            node.show()
        } else {
            node.hide()
        }
    }
    //if the current selection isn't in the list then change
    if (matched && matched.indexOf(currentSpecieID) == -1 && validID) feedPanelSpecies(validID)
}