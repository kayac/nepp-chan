from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
import sys
import os

def convert_pdf_with_docling(pdf_path, output_md_path):
    # Configure options
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True # Enable OCR for scanned content
    pipeline_options.do_table_structure = True # Better table analysis

    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    print(f"Converting {pdf_path} (this may take a while)...")
    result = converter.convert(pdf_path)
    
    # Export to markdown
    markdown_content = result.document.export_to_markdown()
    
    with open(output_md_path, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print(f"Saved to {output_md_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 convert_docling.py <input_pdf> <output_md>")
        sys.exit(1)
        
    convert_pdf_with_docling(sys.argv[1], sys.argv[2])
