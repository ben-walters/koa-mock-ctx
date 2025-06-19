# Contributing to koa-mock-ctx

First off, thank you for considering contributing to `koa-mock-ctx`! I welcome any and all contributions. Your help is greatly appreciated.

This document provides a set of guidelines to help you contribute effectively.

## Code of Conduct

DBAD (Don't be a dick), pretty much sums it up. Report anyone you feel is not following this simple, concise rule.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please ensure it hasn't already been reported by searching the [Issues](https://github.com/ben-walters/koa-mock-ctx/issues) on GitHub.

If you're unable to find an open issue addressing the problem, please [open a new one](https://github.com/ben-walters/koa-mock-ctx/issues/new). Be sure to include:

- A **clear and descriptive title**.
- A **detailed description** of the problem, including what you expected to happen and what actually happened.
- A **minimal, reproducible code snippet** that demonstrates the bug. This is the most important step!
- The version of `koa-mock-ctx`, Node.js, and any other relevant packages you are using.

### Suggesting Enhancements

If you have an idea for a new feature or an improvement to an existing one, please [open a new issue](https://github.com/ben-walters/koa-mock-ctx/issues/new) to discuss it.

- Provide a clear title and a detailed description of the proposed enhancement.
- Explain why this enhancement would be useful to other users.
- Provide a code example if possible to illustrate the new or improved API.

### Submitting Pull Requests

I love pull requests, but please check the [Issues](https://github.com/ben-walters/koa-mock-ctx/issues) before submitting. To submit one, please follow these steps.

#### 1. Setting Up Your Development Environment

1.  **Fork** the repository on GitHub.
2.  **Clone** your fork locally:
    ```bash
    git clone https://github.com/your-username/koa-mock-ctx.git
    cd koa-mock-ctx
    ```
3.  **Install dependencies**. We recommend using `npm`:
    ```bash
    npm ci
    ```

#### 2. Making Your Changes

1.  Create a new branch from `main` for your changes. Please use a descriptive name.
    ```bash
    git checkout -b feat/my-awesome-feature
    ```
2.  Make your code changes.

3.  **Code Style and Formatting**

    This project uses [EditorConfig](https://editorconfig.org/), [Prettier](https://prettier.io/), and [ESLint](https://eslint.org/) to maintain consistent code style and quality. The configuration files (`.editorconfig`, `.prettierrc`, `.eslintrc.js`) are included in the repository and should be automatically recognized by your code editor.

    I highly recommend installing the corresponding plugins for your editor (e.g., EditorConfig for VS Code, Prettier - Code formatter, ESLint) to get real-time feedback and automatic formatting on save.

    Before committing, you can manually run the linter to catch any issues. The CI build will fail if the code does not adhere to the style guidelines.

    ```bash
    npm run lint
    ```

4.  **Add Tests!**

    Since this is a testing utility, any new feature or bug fix **must** be accompanied by tests to prove its correctness and prevent future regressions.

    Ensure all tests pass and that you maintain 100% test coverage.

    ```bash
    npm test
    ```

5.  Commit your changes using a descriptive commit message. We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
    ```bash
    git commit -m "feat: Add support for mocking websockets"
    ```
6.  Push your branch to your fork on GitHub:
    ```bash
    git push origin feat/my-awesome-feature
    ```

#### 3. Opening the Pull Request

1.  Open a pull request from your fork to the `main` branch of the original `koa-mock-ctx` repository.
2.  Provide a clear title and a detailed description of your changes.
3.  Link to any relevant issues (e.g., "Closes #123").
4.  Ensure the "Allow edits from maintainers" checkbox is ticked so we can help with minor changes if needed.

Thank you again for your contribution!
