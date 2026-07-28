// Mirrors the exact icon shapes drawn by the community tracker
// (https://benzlovely12.github.io/row-map/, its ICONS.<type>.svg functions) so
// a matched chest reads as the same icon there and here, not just the same
// color. viewBox/paths copied directly from its source.
import React from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { CommunityChestPoint } from "../api/communityMysteryChests";

function HighChest() {
  return (
    <>
      <Rect x={9} y={22} width={22} height={11} rx={2} fill="#9a86e0" stroke="#473a86" strokeWidth={2} />
      <Path d="M9 22 q11 -8 22 0" fill="#b6a6ef" stroke="#473a86" strokeWidth={2} />
      <Rect x={8} y={25} width={24} height={3.5} fill="#473a86" />
      <Path d="M20 5 l6 8 h-4 v6 h-4 v-6 h-4z" fill="#cfc4f7" stroke="#473a86" strokeWidth={1.8} strokeLinejoin="round" />
    </>
  );
}
function Butterfly() {
  return (
    <>
      <Ellipse cx={13} cy={15} rx={8} ry={7} fill="#5bb6ff" stroke="#1f5a8c" strokeWidth={1.6} />
      <Ellipse cx={27} cy={15} rx={8} ry={7} fill="#5bb6ff" stroke="#1f5a8c" strokeWidth={1.6} />
      <Ellipse cx={14} cy={27} rx={6} ry={6} fill="#7ec8ff" stroke="#1f5a8c" strokeWidth={1.6} />
      <Ellipse cx={26} cy={27} rx={6} ry={6} fill="#7ec8ff" stroke="#1f5a8c" strokeWidth={1.6} />
      <Rect x={18.6} y={10} width={2.8} height={22} rx={1.4} fill="#27405a" />
      <Path d="M20 10 q-3 -5 -6 -5 M20 10 q3 -5 6 -5" fill="none" stroke="#27405a" strokeWidth={1.4} />
    </>
  );
}
function Sun() {
  return (
    <>
      <Circle cx={20} cy={20} r={8} fill="#f6b51e" stroke="#9c6a06" strokeWidth={2} />
      <G stroke="#f6b51e" strokeWidth={3} strokeLinecap="round">
        <Line x1={20} y1={4} x2={20} y2={9} />
        <Line x1={20} y1={31} x2={20} y2={36} />
        <Line x1={4} y1={20} x2={9} y2={20} />
        <Line x1={31} y1={20} x2={36} y2={20} />
        <Line x1={8.5} y1={8.5} x2={12} y2={12} />
        <Line x1={28} y1={28} x2={31.5} y2={31.5} />
        <Line x1={31.5} y1={8.5} x2={28} y2={12} />
        <Line x1={12} y1={28} x2={8.5} y2={31.5} />
      </G>
    </>
  );
}
function Waterball() {
  return (
    <>
      <Circle cx={20} cy={22} r={11} fill="#7ec8ff" fillOpacity={0.55} stroke="#1f5a8c" strokeWidth={2} />
      <Path d="M20 8 q5 7 5 11 a5 5 0 0 1 -10 0 q0 -4 5 -11z" fill="#3a93e0" stroke="#1f5a8c" strokeWidth={1.6} />
      <Ellipse cx={16} cy={19} rx={2.5} ry={3.5} fill="#ffffff" fillOpacity={0.7} />
    </>
  );
}
function Snowman() {
  return (
    <>
      <Circle cx={20} cy={21} r={13} fill="#eaf4ff" stroke="#7fa8c9" strokeWidth={2} />
      <Circle cx={15} cy={19} r={2} fill="#2c3e50" />
      <Circle cx={25} cy={19} r={2} fill="#2c3e50" />
      <Path d="M20 22 l5 1.5 -5 1.5z" fill="#f0922e" />
      <Path d="M14 28 q6 4 12 0" fill="none" stroke="#7fa8c9" strokeWidth={1.6} strokeLinecap="round" />
    </>
  );
}
function WinterChest() {
  return (
    <>
      <Rect x={8} y={20} width={24} height={13} rx={2} fill="#d96a86" stroke="#7c2840" strokeWidth={2} />
      <Path d="M8 20 q12 -9 24 0" fill="#e88aa0" stroke="#7c2840" strokeWidth={2} />
      <Rect x={7} y={23.5} width={26} height={3.5} fill="#7c2840" />
      <G stroke="#eaf4ff" strokeWidth={1.6} strokeLinecap="round">
        <Line x1={20} y1={3} x2={20} y2={14} />
        <Line x1={14.5} y1={5} x2={25.5} y2={12} />
        <Line x1={25.5} y1={5} x2={14.5} y2={12} />
      </G>
    </>
  );
}
function MysteryBox() {
  return (
    <>
      <Rect x={7} y={15} width={26} height={17} rx={2} fill="#4a4060" stroke="#1e1830" strokeWidth={2} />
      <Path d="M7 15 l13 -5 l13 5" fill="#6a5a88" stroke="#1e1830" strokeWidth={2} strokeLinejoin="round" />
      <Line x1={20} y1={10} x2={20} y2={32} stroke="#1e1830" strokeWidth={1.6} />
      <Line x1={7} y1={23} x2={33} y2={23} stroke="#1e1830" strokeWidth={1.6} />
      <SvgText x={20} y={29} fontSize={15} fontWeight="900" fill="#e8d8ff" textAnchor="middle">?</SvgText>
    </>
  );
}

const SUBTYPE_GLYPH: Record<CommunityChestPoint["subtype"], () => React.JSX.Element> = {
  high: HighChest,
  butterfly: Butterfly,
  sun: Sun,
  rain: Waterball,
  snowman: Snowman,
  winter: WinterChest,
};

export function MysteryChestGlyph({ subtype, size }: { subtype?: CommunityChestPoint["subtype"]; size: number }) {
  const Glyph = subtype ? SUBTYPE_GLYPH[subtype] : MysteryBox;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Glyph />
    </Svg>
  );
}
