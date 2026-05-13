module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
    serviceworker: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  ignorePatterns: [
    "dist",
    "build",
    "coverage",
    "client — копия/dist",
    "**/dist/**",
    "**/build/**",
    "*.min.js",
    "*.bundle.js",
    ".eslintrc.js"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh", "@typescript-eslint"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "no-console": "warn",
    "no-undef": "error",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  overrides: [
    {
      // Node.js scripts
      files: [
        "*.js",
        "scripts/**/*.js",
        "check-duplicates.js",
        "cleanup-final.js",
        "final-cleanup.js",
        "fix-duplicates.js",
        "style-analysis.js"
      ],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        "no-console": "off",
      },
    },
    {
      // Service worker files
      files: ["**/sw.js", "**/service-worker.js"],
      env: {
        serviceworker: true,
        browser: true,
      },
      rules: {
        "no-console": "off",
      },
    },
    {
      // Client-side React files
      files: ["client/src/**/*.{ts,tsx,js,jsx}"],
      env: {
        browser: true,
        es2020: true,
      },
      rules: {
        "no-console": "warn",
      },
    },
    {
      // Server-side files
      files: ["server/**/*.{ts,js}"],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        "no-console": "off",
      },
    },
  ],
};
