from pathlib import Path

source = Path('scripts/patch_text_library.py').read_text(encoding='utf-8')
source = source.replace(
    "s2, n = re.subn(pattern, new_block, s, count=1, flags=re.S)",
    "s2, n = re.subn(pattern, lambda m: new_block, s, count=1, flags=re.S)",
)
exec(compile(source, 'scripts/patch_text_library.py', 'exec'), {})
