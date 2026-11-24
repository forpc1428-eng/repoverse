import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'

const transparent = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--mono)' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.04)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,.06)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--c1) 35%, transparent) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--c2)' },
})

export default function CodeEditor({ value, onChange, filename, height = '62vh' }) {
  const [lang, setLang] = useState(null)
  useEffect(() => {
    let alive = true
    setLang(null)
    const desc = filename && LanguageDescription.matchFilename(languages, filename)
    if (desc) desc.load().then((l) => alive && setLang(l)).catch(() => {})
    return () => {
      alive = false
    }
  }, [filename])
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      height={height}
      theme="dark"
      extensions={[transparent, EditorView.lineWrapping, ...(lang ? [lang] : [])]}
      basicSetup={{ foldGutter: true, highlightActiveLine: true, bracketMatching: true, autocompletion: true }}
    />
  )
}
