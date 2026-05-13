module.exports = {
  projectId: process.env.CHROMATIC_PROJECT_TOKEN,
  // Options:
  storybookBuildDir: 'storybook-static',
  // Don't allow snapshots to be taken on CI
  onlyChanged: process.env.CI === 'true',
  // Don't allow the build to pass when there are visual changes
  exitZeroOnChanges: false,
  // Don't allow the build to fail when there are visual changes
  exitOnceUploaded: false,
};