# Verify Links Workflow

This workflow automatically tests all equipment links in the website to ensure they correctly point to the intended FF11 Wiki pages, preventing any silent redirection errors.

## Steps

1. **Extract Dictionary**: Read `article.html` and extract all registered item names and URLs from the `linkMap` dictionary.
2. **Fetch Page Titles**: For each URL, make an HTTP request to the FF11 Wiki and read the `<title>` tag of the resulting page.
3. **Validate Matches**: Compare the page title against the registered item name. If the title does not contain the item name (or a valid abbreviation), flag it as a mismatch.
4. **Generate Report**: Compile a list of all mismatched URLs and missing pages.
5. **Auto-Correction (Optional)**: If errors are found, the AI will use its web search capabilities to find the correct IDs and propose an update to `article.html`.

// turbo-all
