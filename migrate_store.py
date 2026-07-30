import os
import re

src_dir = 'C:/Users/--X/.gemini/antigravity/scratch/wordapa7/src'

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Replace useDocStore imports
            if 'useDocStore' in content and filepath.replace('\\', '/') != 'C:/Users/--X/.gemini/antigravity/scratch/wordapa7/src/store/useDocStore.ts':
                pass # I need to think of a better way to do this if I want to actually write a script.
