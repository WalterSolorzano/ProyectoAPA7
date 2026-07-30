import os

src = 'C:/Users/--X/.gemini/antigravity/scratch/wordapa7/src/store'
os.makedirs(os.path.join(src, 'slices'), exist_ok=True)

open(os.path.join(src, 'slices', 'docSlice.ts'), 'w').write("export interface DocSlice { doc: any; }")
open(os.path.join(src, 'slices', 'rulesSlice.ts'), 'w').write("export interface RulesSlice { rules: any; }")
open(os.path.join(src, 'slices', 'wizardSlice.ts'), 'w').write("export interface WizardSlice { wizardStep: number; }")
open(os.path.join(src, 'slices', 'llmSlice.ts'), 'w').write("export interface LLMSlice { llmProgress: any; }")
open(os.path.join(src, 'slices', 'previewSlice.ts'), 'w').write("export interface PreviewSlice { previewHtml: string; }")

print("Slices created successfully")
