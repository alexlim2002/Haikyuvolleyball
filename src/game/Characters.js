const LW = 800;

export const TIER = {
  speed:    { 하: 3/LW, 중: 5/LW, 상: 7/LW },
  power:    { 하: 0.75, 중: 1.0,  상: 1.3  },
  physique: { 소: 0.85, 중: 1.0,  대: 1.2  },
  stamina:  { 하: 80,   중: 120,  상: 160  },
};

export const CHARACTERS = [
  {
    id: 'hinata', name: '히나타', fullName: '히나타 쇼요', file: '히나타쇼요.png',
    serveTypes: ['UNDERHAND'],
    stats: { speed: '상', power: '중', physique: '소', stamina: '상' },
    aiType: 'attack',
  },
  {
    id: 'kageyama', name: '카게야마', fullName: '카게야마 토비오', file: '카게야마토비오.png',
    serveTypes: ['UNDERHAND', 'OVERHAND', 'JUMP'],
    stats: { speed: '중', power: '중', physique: '중', stamina: '중' },
    aiType: 'rally',
  },
  {
    id: 'asahi', name: '아즈마네', fullName: '아즈마네 아사히', file: '아즈마네아사히.png',
    serveTypes: ['UNDERHAND', 'OVERHAND', 'JUMP'],
    stats: { speed: '하', power: '상', physique: '대', stamina: '하' },
    aiType: 'attack',
  },
  {
    id: 'nishinoya', name: '니시노야', fullName: '니시노야 유', file: '니시노야유.png',
    serveTypes: ['UNDERHAND'],
    stats: { speed: '상', power: '하', physique: '소', stamina: '상' },
    aiType: 'defense',
  },
  {
    id: 'tsukishima', name: '츠키시마', fullName: '츠키시마 케이', file: '츠키시마케이.png',
    serveTypes: ['UNDERHAND', 'OVERHAND'],
    stats: { speed: '중', power: '중', physique: '대', stamina: '하' },
    aiType: 'rally',
  },
];
