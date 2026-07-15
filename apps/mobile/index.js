// Must be the very first import — react-native-gesture-handler requires
// this at the top of the entry file so its native handlers register
// before any screen mounts (React Navigation gestures depend on it).
import "react-native-gesture-handler";
import { registerRootComponent } from "expo";

import App from "./App";

registerRootComponent(App);
