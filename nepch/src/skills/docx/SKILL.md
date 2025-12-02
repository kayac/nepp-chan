# Word 文書作成スキル

## 概要
Word 文書（.docx）を作成・編集する際のベストプラクティス。

## 必要なパッケージ
- `docx`: Word 文書の生成
- `mammoth`: Word 文書の読み込み

## 基本パターン

### 新規文書の作成
\`\`\`typescript
import { Document, Packer, Paragraph, TextRun } from "docx";

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        children: [new TextRun("Hello World")],
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
\`\`\`

## 注意事項
- 必ず UTF-8 エンコーディングを使用
- 大きなファイルはストリーミング処理を検討
