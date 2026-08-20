# Workspace rules for Casita Capital School

This file registers rules for this workspace, enforcing visual consistency, design-system integrity, and strict type safety across all files.

---

# Strict TypeScript Requirements

You must adhere to strict type-checked TypeScript configurations. When writing, modifying, or refactoring code, do not violate the following rules:

### 1. Absolute Ban on `any`
* Never declare variables, parameters, or returns with the `any` type. Use `unknown` or explicit generics if a type is variable.
* Never assign an untyped or implicitly evaluation-typed value to a strongly typed variable.
* Never read properties off of an unvalidated object. Cast it using a type guard first.

### 2. Strict Undefined and Null Management
* Do not write redundant checking blocks if the TypeScript compiler or upstream types dictate that the value cannot possibly be nullish or `undefined`.
* When utilizing a `switch` statement over union types that include `undefined` or partial state configurations, every outcome must be strictly and explicitly exhausted.

### 3. Component Reuse & Design Consistency Rules
* All colors, typography, grid spacing (8px), border-radius (6px), and card elevation must consume the centralized theme in `src/theme/`.

### 4. Verification Command
Before finalizing your generation or marked task, validate your modifications by running:
`npm run typecheck`
