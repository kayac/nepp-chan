import re
import sys

def clean_kouhou_text(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Strategy:
    # 1. Remove excessive leading spaces (indentation normalization)
    # 2. Rejoin lines that are likely hard-wrapped within a paragraph
    # 3. Detect and format headers
    # 4. Remove form feed characters
    
    lines = text.splitlines()
    cleaned_lines = []
    
    # Pre-cleaning: Remove form feeds and trailing spaces
    pre_processed = []
    for line in lines:
        line = line.replace('\f', '') # Remove form feed
        line = line.rstrip()
        # Heuristic: If line is just page number or "Otoineppu...", maybe strip (optional)
        pre_processed.append(line)
        
    # Line Rejoining Logic
    # If the current line ends with a Japanese character and the next line starts with a Japanese character
    # and indentation is similar, they join.
    
    buffer = ""
    
    for i, line in enumerate(pre_processed):
        stripped = line.strip()
        if not stripped:
            if buffer:
                cleaned_lines.append(buffer)
                buffer = ""
            cleaned_lines.append("") # Keep empty line
            continue
            
        # Header Detection (Simple Heuristic for Kouhou)
        # Often headers are surrounded by empty lines or have specific spacing
        # For now, just simplistic line joining for readable text.
        
        if not buffer:
            buffer = stripped
        else:
            # Check if we should join
            # Join if: buffer ends with non-punctuation? specific heuristic needed.
            # Simple approach: join with nothing if Japanese, space if English
            
            # This is a very basic clean up.
            # Real layout analysis is hard without OCR coordinates.
            # Let's assume joining lines is generally good for readability.
            
            buffer += " " + stripped
            
    if buffer:
        cleaned_lines.append(buffer)

    # Output back content
    new_text = "\n".join(cleaned_lines)
    
    # Save (overwrite for now or distinct file)
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(new_text)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        clean_kouhou_text(sys.argv[1])
