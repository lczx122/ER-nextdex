// Clean, highly-readable system UI stack used as the default and as a fallback.
const SYSTEM_STACK = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`

// Fonts that actually ship as .ttf files in /font. Anything else (e.g. the
// default "clean") just uses the system stack — no network request, no FOUT.
const BUNDLED = new Set(['basis33', 'Inconsolata', 'Determination'])

export function loadFont(fontName){
    const html = document.querySelector('html')
    if (!html) return
    if (!BUNDLED.has(fontName)){
        html.style.fontFamily = SYSTEM_STACK
        return
    }
    const font = new FontFace(fontName, `url(font/${fontName}.ttf) format("truetype")`)
    font.load()
        .then((loaded)=>{
            document.fonts.add(loaded)
            // Always keep the system stack as a fallback for missing glyphs.
            html.style.fontFamily = `"${fontName}", ${SYSTEM_STACK}`
        })
        .catch((e)=>{
            console.warn(e)
            html.style.fontFamily = SYSTEM_STACK
        })
}
