# Contributing to Riqor

Thank you for contributing to Riqor!

## Development & Verification Steps

Before submitting a pull request, ensure all tests pass and package
artifacts pass inspection:

```bash
bun install
bun test
bun run riqor:pack
bun run riqor:inspect -- packages/riqor/riqor-*.tgz
```

## Pull Request Guidelines

- Ensure your code has test coverage.
- Do not introduce external runtime dependencies for Node users.
- Verify that zero secrets, credentials, or private keys are exposed.
