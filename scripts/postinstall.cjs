/**
 * Postinstall: patch react-native VirtualView codegen files.
 *
 * React Native 0.85.x Metro codegen bug: the Flow parser cannot handle
 * DirectEventHandler<T> when T is either a named type alias containing nested
 * Readonly<{}> shapes, or an inline object with nested non-Readonly objects.
 * Errors: "Unable to determine event arguments for 'onModeChange'"
 *         "typeAnnotation of event doesn't have a name"
 *
 * Fix: remove the onModeChange prop entirely from both VirtualView component
 * files. Both are `interfaceOnly: true` (no native code generated, only TS
 * type declarations), so dropping an unused internal event prop has no runtime
 * impact whatsoever.
 */

const fs = require("fs");
const path = require("path");

const FILES = [
  "node_modules/react-native/src/private/components/virtualview/VirtualViewExperimentalNativeComponent.js",
  "node_modules/react-native/src/private/components/virtualview/VirtualViewNativeComponent.js",
];

const PATCHED_CONTENT = {
  "VirtualViewExperimentalNativeComponent.js": `/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {ViewProps} from '../../../../Libraries/Components/View/ViewPropTypes';
import type {Int32} from '../../../../Libraries/Types/CodegenTypes';
import type {HostComponent} from '../../types/HostComponent';

import codegenNativeComponent from '../../../../Libraries/Utilities/codegenNativeComponent';

type VirtualViewExperimentalNativeProps = Readonly<{
  ...ViewProps,
  initialHidden?: boolean,
  removeClippedSubviews?: boolean,
  renderState: Int32,
}>;

// TODO: Rename to eliminate "Experimental" suffix in the name.
export default codegenNativeComponent<VirtualViewExperimentalNativeProps>(
  'VirtualViewExperimental',
  {
    interfaceOnly: true,
  },
) as HostComponent<VirtualViewExperimentalNativeProps>;
`,
  "VirtualViewNativeComponent.js": `/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {ViewProps} from '../../../../Libraries/Components/View/ViewPropTypes';
import type {Int32} from '../../../../Libraries/Types/CodegenTypes';
import type {HostComponent} from '../../types/HostComponent';

import codegenNativeComponent from '../../../../Libraries/Utilities/codegenNativeComponent';

type VirtualViewNativeProps = Readonly<{
  ...ViewProps,
  initialHidden?: boolean,
  removeClippedSubviews?: boolean,
  renderState: Int32,
}>;

export default codegenNativeComponent<VirtualViewNativeProps>('VirtualView', {
  interfaceOnly: true,
}) as HostComponent<VirtualViewNativeProps>;
`,
};

const root = path.resolve(__dirname, "..");

FILES.forEach((relPath) => {
  const fullPath = path.resolve(root, relPath);
  const fileName = path.basename(fullPath);

  if (!fs.existsSync(fullPath)) {
    console.warn(`[postinstall] Skipping missing file: ${relPath}`);
    return;
  }

  const current = fs.readFileSync(fullPath, "utf8");
  const desired = PATCHED_CONTENT[fileName];

  if (!desired) {
    console.warn(`[postinstall] No patch defined for: ${fileName}`);
    return;
  }

  if (current === desired) {
    // Already patched — silent skip
    return;
  }

  fs.writeFileSync(fullPath, desired, "utf8");
  console.log(`[postinstall] Patched: ${relPath}`);
});
