#!/bin/bash
# Run: bash sync-photos.sh
# Film:    images/projects/photography/film/Photography_film_001.jpg ...
# Digital: images/projects/photography/digital/Photography_digital_001.jpg ...

CONTENT="content.md"

update_gallery() {
    local section="$1"
    local dir="$2"

    local imgs=()
    while IFS= read -r f; do
        imgs+=("$f")
    done < <(find "$dir" -maxdepth 1 -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" \) | sed 's|^\./||' | sort)

    if [ ${#imgs[@]} -eq 0 ]; then
        echo "  No images in $dir — skipping $section"
        return
    fi

    local gallery_block="### Gallery"$'\n'
    for img in "${imgs[@]}"; do
        gallery_block+="![]($img)"$'\n'
    done

    /usr/bin/python3 - "$CONTENT" "$section" "$gallery_block" <<'PYEOF'
import sys, re
content_file, section_name, new_gallery = sys.argv[1], sys.argv[2], sys.argv[3]
with open(content_file, 'r') as f:
    text = f.read()
pattern = rf'(## {re.escape(section_name)}\n(?:(?!^## )[\s\S])*?)(### Gallery\n(?:!\[.*?\]\(.*?\)\n)*)'
new_text, n = re.subn(pattern, rf'\g<1>' + new_gallery, text, flags=re.MULTILINE)
if n == 0:
    print(f"  Warning: ### Gallery not found inside ## {section_name}")
else:
    with open(content_file, 'w') as f:
        f.write(new_text)
    print(f"  {section_name}: {new_gallery.count('![](')} image(s) synced")
PYEOF
}

echo "Syncing photography galleries..."
update_gallery "Film"    "images/projects/photography/film"
update_gallery "Digital" "images/projects/photography/digital"
echo "Done. Refresh the browser."
