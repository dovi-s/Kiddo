// RootNavigator — the authenticated app shell, re-platformed onto React
// Navigation 7 (native-stack). Replaces the old hand-rolled setScreen swaps
// that unmounted the whole dashboard on every push. Now detail screens push
// over a persistent Dashboard with real native transitions + iOS back-swipe,
// and the dashboard underneath keeps its tab + scroll + data state.
//
// The bottom tab bar still lives inside DashboardScreen (a polished custom
// bar with the center gift button) — tabs don't need their own navigator and
// keeping it avoids re-theming a working surface. This stack owns the
// push/detail layer only.
import React from "react";
import {
  NavigationContainer,
  useNavigationContainerRef,
  type Theme,
  DefaultTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "@kora/tokens";
import { DashboardScreen } from "../screens/DashboardScreen";
import { FundDetailScreen } from "../screens/FundDetailScreen";
import { AddFundScreen } from "../screens/AddFundScreen";
import { PlanScreen } from "../screens/PlanScreen";
import { RecurringScreen } from "../screens/RecurringScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import type { ApiFund, ApiUser } from "../api";

export type RootStackParamList = {
  Dashboard: undefined;
  FundDetail: { fund: ApiFund };
  AddFund: undefined;
  Plan: { fundId?: string } | undefined;
  Recurring: { fundId: string; fundName?: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Brand theme so the navigator's container/card backgrounds are cream, not the
// default white — kills the white flash between transitions.
const navTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: colors.cream,
    card: colors.cream,
    primary: colors.evergreen,
    text: colors.ink,
    border: "#E5DDD4",
    notification: colors.gold,
  },
};

export function RootNavigator({
  user,
  onLogout,
  initialFund,
}: {
  user: ApiUser;
  onLogout: () => void;
  initialFund?: ApiFund | null;
}) {
  const navRef = useNavigationContainerRef<RootStackParamList>();

  return (
    <NavigationContainer
      ref={navRef}
      theme={navTheme}
      onReady={() => {
        // Deep-linked fund: start on Dashboard, then push FundDetail so the
        // dashboard stays underneath and back-swipe returns to it.
        if (initialFund) {
          navRef.navigate("FundDetail", { fund: initialFund });
        }
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: "slide_from_right",
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="Dashboard">
          {({ navigation }) => (
            <DashboardScreen
              user={user}
              onLogout={onLogout}
              onSelectFund={(fund) => navigation.navigate("FundDetail", { fund })}
              onAddFund={() => navigation.navigate("AddFund")}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="FundDetail">
          {({ navigation, route }) => (
            <FundDetailScreen fund={route.params.fund} onBack={() => navigation.goBack()} />
          )}
        </Stack.Screen>

        <Stack.Screen name="AddFund">
          {({ navigation }) => (
            <AddFundScreen
              onBack={() => navigation.goBack()}
              onCreated={(fund) => navigation.replace("FundDetail", { fund })}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Plan">
          {({ navigation, route }) => (
            <PlanScreen fundId={route.params?.fundId} onBack={() => navigation.goBack()} />
          )}
        </Stack.Screen>

        <Stack.Screen name="Recurring">
          {({ navigation, route }) => (
            <RecurringScreen
              fundId={route.params.fundId}
              fundName={route.params.fundName}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Profile">
          {({ navigation }) => <ProfileScreen user={user} onBack={() => navigation.goBack()} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
