# Shared correlation IDs

The API and CLI have drifted. Make the existing shared contracts package the single source of truth for correlation IDs: valid IDs are 16–32 lowercase hexadecimal characters. The API must preserve a valid supplied ID and use the injected generator when absent; it must reject an invalid supplied ID. The CLI must accept only valid IDs. Preserve exported names and add cross-package regression coverage.
