// KInput — labeled text field. 16px font (the iOS no-zoom minimum), warm card
// background, evergreen focus border, brand muted placeholder. Mirrors the web
// Input idiom (confident 1.5px border, brand focus ring).

import React, { useState } from "react";
import { TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { semanticColors, radius, spacing, typography, touchTarget } from "@kora/tokens";
import { KText } from "./Text";
import { bodyFontFamily } from "./native";

export interface KInputProps extends TextInputProps {
  label?: string;
  containerStyle?: ViewStyle;
}

export function KInput({ label, containerStyle, style, onFocus, onBlur, ...rest }: KInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? <KText variant="label">{label}</KText> : null}
      <TextInput
        placeholderTextColor={semanticColors.text.muted}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            height: touchTarget.minimum + 4,
            borderWidth: 1.5,
            borderColor: focused ? semanticColors.action.primary : semanticColors.surface.muted,
            borderRadius: radius.control,
            paddingHorizontal: spacing.md,
            fontSize: typography.size.base, // 16 — prevents iOS focus-zoom
            color: semanticColors.text.primary,
            backgroundColor: semanticColors.surface.card,
            fontFamily: bodyFontFamily("regular"),
          },
          style,
        ]}
      />
    </View>
  );
}
