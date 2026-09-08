import * as monaco from 'monaco-editor';

const mode={completionItems:true,definitions:true,references:true,diagnostics:true,documentSymbols:true,documentHighlights:true,hovers:true,rename:true,signatureHelp:true,codeActions:true,inlayHints:true,documentRangeFormattingEdits:true,onTypeFormattingEdits:true};
monaco.languages.typescript.typescriptDefaults.setModeConfiguration(mode);
monaco.languages.typescript.javascriptDefaults.setModeConfiguration(mode);
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({noSemanticValidation:false,noSyntaxValidation:false});
monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({noSemanticValidation:false,noSyntaxValidation:false});
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({target:monaco.languages.typescript.ScriptTarget.ES2022,moduleResolution:monaco.languages.typescript.ModuleResolutionKind.NodeJs,module:monaco.languages.typescript.ModuleKind.ESNext,allowJs:true,allowNonTsExtensions:true,jsx:monaco.languages.typescript.JsxEmit.ReactJSX});
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({target:monaco.languages.typescript.ScriptTarget.ES2022,moduleResolution:monaco.languages.typescript.ModuleResolutionKind.NodeJs,module:monaco.languages.typescript.ModuleKind.ESNext,allowJs:true,checkJs:true});
monaco.languages.json.jsonDefaults.setModeConfiguration({completionItems:true,definitions:true,references:true,diagnostics:true,documentSymbols:true,documentHighlights:true,hovers:true,documentRangeFormattingEdits:true,foldingRanges:true,selectionRanges:true});
