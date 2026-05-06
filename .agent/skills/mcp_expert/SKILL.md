# Model Context Protocol (MCP) Expert Skill

## Description
このスキルは、Model Context Protocol (MCP) を活用して、AIエージェント（Antigravity）が外部のデータソース、ツール、APIとシームレスに連携するための知識とワークフローを提供します。
動画「【初心者向け】話題のMCPとは何か？」で紹介されている「AI界のUSB-C」としての実用性を、プロジェクト内で最大化します。

## Integrated Connections (Conceptual)
以下の主要なMCPサーバーの役割をこのスキルに統合しています：
1. **GitHub MCP**: リポジトリ操作、Issue管理、コード検索の最適化。
2. **Google Drive/Docs MCP**: クラウド上のドキュメント読み書きとプロジェクト管理。
3. **Knowledge/Memory MCP**: 長期的なプロジェクトの文脈（コンテクスト）の保持。
4. **Brave Search/Google Search MCP**: 最新の技術動向や解決策のリアルタイム検索。
5. **Postgres/SQL MCP**: データベース操作の自然言語による自動化。

## Instructions
1. **接続の確立**: 外部データが必要な際、適切なMCPリソース（`list_resources`）を確認し、最適なサーバーを選択します。
2. **コンテキストの注入**: 取得した外部データを、現在のタスク（HP作成、資料作成など）の文脈に正確に反映させます。
3. **安全なデータ転送**: 外部APIとの連携時、機密情報（APIキーなど）が露出しないよう「Safety Sandbox」スキルと連携して検証します。

## Usage
- "GitHubの最新のトレンドを調べて、関連する機能をHPに追加して"
- "Google Driveにある設計書を読み取って、現在のコードと比較して"
- "MCPを使用して、外部の天気APIからデータを取得し、サイトに表示して"
