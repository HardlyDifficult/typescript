import {
  autoCommitFixes,
  type AutoCommitFixesOptions,
  type AutoCommitFixesResult,
  resolveCiBranch,
  runAutoCommitFixesCli,
} from "./auto-commit-fixes.js";
import {
  assertPackageMetadata,
  checkPackageMetadata,
  formatPackageMetadataSuccess,
  PackageMetadataError,
  type CheckPackageMetadataOptions,
  type PackageMetadataIssue,
  type PackageMetadataResult,
  runCheckPackageMetadataCli,
} from "./check-package-metadata.js";
import {
  assertPinnedDependencies,
  checkPinnedDependencies,
  formatPinnedDependenciesSuccess,
  PinnedDependenciesError,
  type CheckPinnedDependenciesOptions,
  type PinnedDependenciesResult,
  type UnpinnedDependency,
  runCheckPinnedDependenciesCli,
} from "./check-pinned-deps.js";
import {
  parsePublishArgs,
  publishPackages,
  type PublishedPackage,
  type PublishPackagesOptions,
  type PublishPackagesResult,
  runPublishCli,
  type SkippedPackage,
} from "./publish.js";
import { findWorkspaceRoot } from "./workspace.js";

export {
  autoCommitFixes,
  assertPackageMetadata,
  assertPinnedDependencies,
  checkPackageMetadata,
  checkPinnedDependencies,
  findWorkspaceRoot,
  formatPackageMetadataSuccess,
  formatPinnedDependenciesSuccess,
  PackageMetadataError,
  parsePublishArgs,
  PinnedDependenciesError,
  publishPackages,
  resolveCiBranch,
  runAutoCommitFixesCli,
  runCheckPackageMetadataCli,
  runCheckPinnedDependenciesCli,
  runPublishCli,
  type AutoCommitFixesOptions,
  type AutoCommitFixesResult,
  type CheckPackageMetadataOptions,
  type CheckPinnedDependenciesOptions,
  type PackageMetadataIssue,
  type PackageMetadataResult,
  type PublishedPackage,
  type PublishPackagesOptions,
  type PublishPackagesResult,
  type PinnedDependenciesResult,
  type SkippedPackage,
  type UnpinnedDependency,
};

export const ci = {
  fix: autoCommitFixes,
  publish: publishPackages,
  requirePackageMetadata: assertPackageMetadata,
  requirePinnedDependencies: assertPinnedDependencies,
} as const;

export const packageName = "@hardlydifficult/ci-scripts";
