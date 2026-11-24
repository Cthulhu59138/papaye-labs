// Les codes reprennent l'intersection du catalogue et de la FT relue. Les plafonds
// s'appliquent au groupe indiqué, jamais à une pointe d'une durée limitée.
const interieur = ['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PIC', 'PID'];
const exterieur = ['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC', 'PED'];
const codes = (series, groupe) => series.map(serie => serie + ' ' + groupe);
const ft = id => 'https://fnp.edf.fr/fr/ficheconstitutive/download/' + id;

export const fichesThermiques = {
  106: {
    ft: ft(40419), indice: 'S008',
    detail: 'FT G10/10.10 rév. 14, p. 1, 4–5. GEHODUR-S3-Eisenglimmer sur acier en intérieur sec, 500 °C en continu. Trois couches de 30 µm secs. Sur acier nu, grenaillage Sa 3 et rugosité Moyen G. Une ancienne couche conservée demande la préparation spécifique p. 5. La polymérisation nécessite une montée en température ; exemples de la fiche : 1 h à 230 °C ou 24 h à au moins 160 °C, après au moins 6 h de séchage à 23 °C de la dernière couche. Vérifier que la pièce peut suivre ce cycle.',
    plages: [{ codes: codes(['EIA', 'EID', 'PIA', 'PIC', 'PID'], '105'), max: 500, inclus: true, condition: 'Acier en intérieur sec ; cycle de polymérisation à chaud à vérifier.' }]
  },
  1108: {
    ft: ft(38658), indice: 'S006',
    detail: 'FT PPG n° 53 ind. E, p. 1–3. Deux couches de CENTREPOX N EVO de 70 µm et une finition CENTRIFUGON EAP EVO de 60 µm. En chaleur sèche, plafond de 200 °C en continu. Acier nu préparé à Sa 2½ ; prescriptions distinctes pour l’inox. Durcissement final de 7 jours à 20 °C et 50 % HR. La FT vise notamment PIC REP et EPR ; vérifier la codification et les tolérances du chantier.',
    plages: [
      { codes: codes(interieur, '104'), max: 120, inclus: true, condition: 'Surface chaude en chaleur sèche.' },
      { codes: codes(interieur, '105'), max: 200, inclus: true, condition: 'Chaleur sèche en continu ; vérifier le matériau et les tolérances propres à la codification.' }
    ]
  },
  1110: {
    ft: ft(45617), indice: 'S003',
    detail: 'FT Carboline 550-01 rév. 9, p. 1–4. THERMALINE 550 EN, 100 µm secs nominaux. Sur acier nu, préparation Sa 2½. Durcissement avant mise en service de 3 jours à 20 °C et 50 % HR. Limite en continu de 200 °C. Le commentaire documente deux pointes distinctes, 250 °C pendant 72 h au maximum et 300 °C pendant 48 h au maximum. Le commentaire public étend la qualification du groupe 105 à 200 °C ; les pointes du produit au-delà de 200 °C ne prouvent pas la qualification du couple à ces températures. La restriction liner et grandes structures de génie civil de la p. 1 concerne PIC 100.',
    plages: [
      { codes: codes(interieur, '104'), max: 120, inclus: true, condition: 'Service dans la plage du groupe 104.' },
      { codes: codes(interieur, '105'), max: 200, inclus: true, condition: '200 °C en continu ; les pointes documentées à 250 °C ou 300 °C ont des durées limitées.' }
    ]
  },
  1125: {
    ft: ft(48060), indice: 'S010',
    detail: 'FT AKZO INT 700 éd. 10, p. 3–6. Pour les groupes 104/105 sur tôle acier, deux couches de poudre INTERPON 700 de 70 µm chacune sont obligatoires. Préparation mécanique Sa 2½ ; la voie chimique est exclue pour ces groupes. Polymérisation par cuisson au four selon la poudre (160 à 210 °C). Chaleur sèche jusqu’à 200 °C en continu. La FT nomme PIA, PIB, PID et PIC REP. Pour une réparation sur site au groupe 105, la p. 6 renvoie au système liquide 1170 avec remise à nu ; vérifier sa propre limite strictement inférieure à 200 °C.',
    plages: [
      { codes: codes(['PIA', 'PIB', 'PID', 'PIC'], '104'), max: 120, inclus: true, condition: 'Tôle acier, système poudre bicouche cuit au four ; PIC REP uniquement.' },
      { codes: codes(['PIA', 'PIB', 'PID', 'PIC'], '105'), max: 200, inclus: true, condition: 'Tôle acier, système poudre bicouche cuit au four ; pour PIC, REP uniquement dans cette FT.' }
    ]
  },
  1139: {
    ft: ft(51206), indice: 'S002',
    detail: 'FT Carboline n° 400011 ind. 12, p. 1–4. CARBOZINC 11 (75 µm) + ARMORLAST I (100 µm) sur acier Sa 2½. Le tableau donne 400 °C en continu, mais les codifications portent T < 400 °C. La borne retenue est strictement inférieure à 400 °C. PEA/PEB/PEC/PED et EEA/EEB/EEC visent des surfaces non calorifugées ; pour PEX la mention d’en-tête est uniquement T < 400 °C. La prise dépend de l’humidité, avec contrôle du durcissement avant montée en température (p. 4).',
    plages: [
      { codes: codes([...exterieur, 'PEX'], '204'), max: 120, inclus: true, condition: 'Surfaces non calorifugées pour les séries PE et EE. Pour PEX, vérifier le calorifuge.' },
      { codes: codes(exterieur, '205'), max: 400, inclus: false, condition: 'Sur acier non calorifugé ; la codification impose T < 400 °C.' },
      { codes: ['PEX 205'], max: 400, inclus: false, condition: 'Acier, exposition CX ; T < 400 °C. L’en-tête PEX ne précise pas la présence d’un calorifuge.' }
    ]
  },
  1140: {
    ft: ft(43005), indice: 'S006',
    detail: 'FT JOTATEMP 250 rév. 6, p. 1–4. Sur acier, deux couches de JOTATEMP 250 de 150 µm secs, 250 °C maximum en continu. La fiche indique sur acier St 3 minimum ou Sa 2½, profil Rt 50 à 85 µm, et 7 jours à 20 °C, HR < 85 %, avant mise en service. La p. 4 nomme par erreur un autre produit dans la phrase sur le calorifuge ; la notice système attribue explicitement la compatibilité avec calorifuge à JOTATEMP 250.',
    plages: [
      { codes: codes(exterieur, '204'), max: 120, inclus: true, condition: 'Acier carbone, compatibilité avec calorifuge confirmée par la notice système.' },
      { codes: codes(exterieur, '205'), max: 250, inclus: true, condition: 'Sur acier carbone ; la notice système confirme la compatibilité avec calorifuge.' }
    ]
  },
  1141: {
    ft: ft(42952), indice: 'S005',
    detail: 'FT JOTATEMP 1000 rév. 4, p. 1–4. Sur acier, plafond du système de 650 °C en continu, sur surface calorifugée ou non. Deux couches de JOTATEMP 1000 à 150 µm secs chacune. Sur acier, St 3 minimum ou Sa 2½ et rugosité Rt 50 à 85 µm. Durcissement avant mise en service de 24 h à 20 °C et HR < 85 %. Le nombre 1000 appartient au nom commercial.',
    plages: [
      { codes: codes(exterieur, '204'), max: 120, inclus: true, condition: 'Acier, surface calorifugée ou non.' },
      { codes: codes(exterieur, '205'), max: 650, inclus: true, condition: 'Acier en extérieur, surface calorifugée ou non ; 650 °C en continu dans cette fiche.' }
    ]
  },
  1162: {
    ft: ft(50923), indice: 'S002',
    detail: 'FT Maestria 19-004 R08, p. 1–3. STRIATHERM 350 V01 sur acier, primaire et finition de 50 µm secs chacun. Le système indique 350 °C maximum en service, sans durée de pointe ni mention explicite du régime continu. Le commentaire précise 60 < T < 120 °C pour 104 et T > 120 °C pour 105. Sur acier nu, Sa 2½, rugosité Ra 10 à 12,5 µm. Durcissement de 4 jours à 20 °C avant mise en service. Faire confirmer le régime d’exposition demandé. La notice publique du 30 juillet 2026 étend PIC 105 jusqu’à 350 °C sur la base des seules conditions accidentelles RRC-A ; aucune validation RRC-B dans cette publication.',
    plages: [
      { codes: codes(interieur, '104'), max: 120, inclus: false, regime: 'service', condition: 'Le commentaire du groupe 104 exclut exactement 120 °C.' },
      { codes: codes(interieur, '105'), max: 350, inclus: true, regime: 'service', condition: '350 °C maximum en service sur acier ; préciser le régime. En PIC 105, extension RRC-A uniquement.' }
    ]
  },
  1170: {
    ft: ft(37432), indice: 'S002',
    detail: 'FT Maestria 23-001 R04, p. 1–3. EPODUX 292 CM, deux couches de 70 µm, puis EPODUX 294 CM, 60 µm. Le tableau général indique 200 °C en continu sous chaleur sèche ; le commentaire affecte au groupe 105 une plage strictement comprise entre 120 et 200 °C, et au 104 entre 60 et 120 °C. La notice publique du 31 janvier 2024 annonce toutefois le groupe 105 jusqu’à 200 °C en continu. À exactement 200 °C, faire confirmer par écrit la portée de cette divergence. Acier nu Sa 2½ ; l’inox reçoit une préparation distincte. Durcissement final de 7 jours à 20 °C et 75 % HR. PIC REP et EPR sont cités.',
    plages: [
      { codes: codes(interieur, '104'), max: 120, inclus: false, condition: 'Chaleur sèche ; le commentaire du groupe 104 exclut exactement 120 °C.' },
      { codes: codes(interieur, '105'), max: 200, inclus: false, condition: 'Chaleur sèche ; à 200 °C, faire confirmer la divergence entre la FT et la notice publique.' }
    ]
  },
  380: {
    ft: ft(25166), indice: 'S005',
    detail: "FT 003-1 R11, p. 1–3. EPODUX PRIMER 61-134 V01 (50 + 50 µm) et POLYSTRIA V01 (40 µm). Le commentaire fixe pour les groupes chauds une température strictement inférieure à 120 °C. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '104'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire fixe pour les groupes chauds une température strictement inférieure à 120 °C." },
      { codes: codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '124'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire fixe pour les groupes chauds une température strictement inférieure à 120 °C." },
      { codes: codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '125'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire fixe pour les groupes chauds une température strictement inférieure à 120 °C." },
      { codes: codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '126'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire fixe pour les groupes chauds une température strictement inférieure à 120 °C." },
      { codes: codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '127'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire fixe pour les groupes chauds une température strictement inférieure à 120 °C." }
    ]
  },
  1013: {
    ft: ft(15242), indice: 'S004',
    detail: "FT CF 10 R09, p. 1–3. FERROCOTE (195 + 195 µm) et POLYSTRIA V01 (60 µm), 450 µm secs. En neuf, PED 204 hydraulique, 60 < T < 120 °C. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['PED'], '204'), max: 120, inclus: false, regime: 'service', condition: "En neuf, PED 204 hydraulique, 60 < T < 120 °C." }
    ]
  },
  1022: {
    ft: ft(12743), indice: 'S004',
    detail: "FT 063 R07, p. 1–3. FERROCOTE (80 + 80 µm) et POLYSTRIA V01 (40 µm). Le commentaire fixe au groupe 204 une limite strictement inférieure à 120 °C. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'PEA', 'PEB'], '204'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire fixe au groupe 204 une limite strictement inférieure à 120 °C." }
    ]
  },
  1036: {
    ft: ft(30757), indice: 'S006',
    detail: "FT CF 09-0907-3 R18, p. 1–3. Deux couches d’EPODUX IM 209 (100 et 350 µm). Spécifique à PED 204 hydraulique en milieu abrité, 60 < T < 120 °C. Faire confirmer les conditions de durcissement avant service.",
    plages: [
      { codes: codes(['PED'], '204'), max: 120, inclus: false, regime: 'service', condition: "Spécifique à PED 204 hydraulique en milieu abrité, 60 < T < 120 °C." }
    ]
  },
  1038: {
    ft: ft(27701), indice: 'S008',
    detail: "FT 09-001 R24, p. 1–3. EPODUX 292 (45 + 45 µm) puis EPODUX 294 (50 µm). Le commentaire du groupe 104 fixe 60 < T < 120 °C. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PIC', 'PID'], '104'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire du groupe 104 fixe 60 < T < 120 °C." }
    ]
  },
  1044: {
    ft: ft(31290), indice: 'S003',
    detail: "FT PPG 125 ind. F, p. 1–2. VIGOR EP 535 NF (100 + 100 µm) et FREITANE 580 (80 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1046: {
    ft: ft(337), indice: 'S001',
    detail: "FT PPG 127 ind. D, p. 1. VIGOR EP 535 NF (80 + 80 µm) et FREITANE 580 (80 µm), sur acier préparé Sa 2½. Maximum de service 120 °C en atmosphère sèche.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'PEA', 'PEB'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1050: {
    ft: ft(41878), indice: 'S007',
    detail: "FT CF 11-013 R14, p. 1–3. EPODUX IM 209 (195 + 195 µm) et POLYSTRIA V01 (60 µm) sur acier nu Sa 2½. Bien que le tableau général indique 120 °C en continu sous chaleur sèche, le groupe 204 est strictement limité à 60 < T < 120 °C.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC', 'PED'], '204'), max: 120, inclus: false, condition: "Bien que le tableau général indique 120 °C en continu sous chaleur sèche, le groupe 204 est strictement limité à 60 < T < 120 °C." }
    ]
  },
  1062: {
    ft: ft(30958), indice: 'S006',
    detail: "FT 08-003-2 R13, p. 1–3. FERROCOTE (120 + 120 µm) et POLYSTRIA V01 (40 µm). Le commentaire inclut 120 °C pour le groupe 204. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC'], '204'), max: 120, inclus: true, regime: 'service', condition: "Le commentaire inclut 120 °C pour le groupe 204." }
    ]
  },
  1063: {
    ft: ft(40443), indice: 'S003',
    detail: "FT 08-018 R11, p. 1–3. Sur acier galvanisé, EPODUX PRIMER 61-134 V01 (50 µm) et POLYSTRIA V01 (50 µm). Le commentaire du groupe 224 fixe 60 < T < 120 °C. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC'], '224'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire du groupe 224 fixe 60 < T < 120 °C." }
    ]
  },
  1065: {
    ft: ft(41988), indice: 'S010',
    detail: "FT CF 11-015 R11, p. 1–3. Sur acier galvanisé, EPODUX IM 209 (150 µm) et POLYSTRIA V01 (50 µm). La FT vise uniquement PED 224 pour le groupe 224 et indique 60 < T < 120 °C. La présence de ce FNP sous PEA, PEB et PEC 224 dans le catalogue demande clarification. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['PED'], '224'), max: 120, inclus: false, condition: "La FT vise uniquement PED 224 pour le groupe 224 et indique 60 < T < 120 °C. La présence de ce FNP sous PEA, PEB et PEC 224 dans le catalogue demande clarification." }
    ]
  },
  1096: {
    ft: ft(42454), indice: 'S005',
    detail: "FT PPG 150 ind. D, p. 1–2. FREITAPOX SR 215 EVO (175 + 175 µm) et FREITANE 580 (100 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC', 'PED'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1097: {
    ft: ft(42398), indice: 'S005',
    detail: "FT PPG 152 ind. E, p. 1–2. CENTREPOX PZ EVO (70 µm), FREITAPOX SR 215 EVO (280 µm), FREITANE 580 (100 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC', 'PED'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1101: {
    ft: ft(42495), indice: 'S005',
    detail: "FT PPG 124 ind. E, p. 1–2. FREITAPOX SR 215 EVO (210 µm) et FREITANE 580 (70 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1102: {
    ft: ft(36193), indice: 'S003',
    detail: "FT PPG 126 ind. D, p. 1–2. FREITAPOX SR 215 EVO (170 µm) et FREITANE 580 (70 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'PEA', 'PEB'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1104: {
    ft: ft(38826), indice: 'S003',
    detail: "FT PPG 52 ind. E, p. 1–2. CENTREPOX PZ EVO (35 + 35 µm) et FREITANE 580 (70 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EIA', 'EIB', 'PIA', 'PIB'], '104'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1153: {
    ft: ft(39777), indice: 'S001',
    detail: "FT ARKEMA 001 ind. J, p. 1–2. PRIMGREEN LAT 12035 (10 µm) et RILSAN T BLACK 7450 AC (300 µm). La FT indique 70 °C pour le primaire et 125 °C pour la finition. Au-dessus de 70 °C, demander une confirmation pour le système complet. Ne pas utiliser les températures de préchauffage ou de fusion comme limites de service.",
    plages: [
      { codes: codes(['PIA', 'PIB', 'PID'], '104'), max: 70, inclus: true, regime: 'service', condition: "La FT indique 70 °C pour le primaire et 125 °C pour la finition. Au-dessus de 70 °C, demander une confirmation pour le système complet." },
      { codes: codes(['PEA', 'PEB', 'PEC', 'PED'], '204'), max: 70, inclus: true, regime: 'service', condition: "La FT indique 70 °C pour le primaire et 125 °C pour la finition. Au-dessus de 70 °C, demander une confirmation pour le système complet." }
    ]
  },
  1171: {
    ft: ft(51144), indice: 'S001',
    detail: "FT ARKEMA 002 ind. G, p. 1–2. PRIMGREEN ENDURANCE (10 µm) et RILSAN T BLACK 7450 AC (300 µm). La FT indique 70 °C pour le primaire et 125 °C pour la finition. Au-dessus de 70 °C, demander une confirmation pour le système complet. Ne pas utiliser les températures de préchauffage ou de fusion comme limites de service.",
    plages: [
      { codes: codes(['PIA', 'PIB', 'PID'], '104'), max: 70, inclus: true, regime: 'service', condition: "La FT indique 70 °C pour le primaire et 125 °C pour la finition. Au-dessus de 70 °C, demander une confirmation pour le système complet." },
      { codes: codes(['PEA', 'PEB', 'PEC', 'PED'], '204'), max: 70, inclus: true, regime: 'service', condition: "La FT indique 70 °C pour le primaire et 125 °C pour la finition. Au-dessus de 70 °C, demander une confirmation pour le système complet." }
    ]
  },
  1174: {
    ft: ft(41292), indice: 'S003',
    detail: "FT 08-005 R16, p. 1–3. PRIMODUX H V01 (100 + 90 µm) et POLYSTRIA V01 (50 µm). Le commentaire du groupe 204 inclut 120 °C ; le tableau du service continu reste non renseigné. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['PEA', 'PEB', 'PEC'], '204'), max: 120, inclus: true, regime: 'service', condition: "Le commentaire du groupe 204 inclut 120 °C ; le tableau du service continu reste non renseigné." }
    ]
  },
  1175: {
    ft: ft(41359), indice: 'S003',
    detail: "FT 11-011 R18, p. 1–3. PRIMODUX H V01 (150 + 150 µm) et POLYSTRIA V01 (50 µm). Le commentaire du groupe 204 fixe 60 < T < 120 °C. 7 jours à 20 °C et 75 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC', 'PED'], '204'), max: 120, inclus: false, regime: 'service', condition: "Le commentaire du groupe 204 fixe 60 < T < 120 °C." }
    ]
  },
  1184: {
    ft: ft(47920), indice: 'S004',
    detail: "FT PPG OSP5 ind. K, p. 1–2. SIGMAFAST 278 D (100 + 130 µm) et FREITANE 580 (70 µm). Maximum de service 120 °C en atmosphère sèche. 7 jours à 20 °C et 50 % HR avant mise en service.",
    plages: [
      { codes: codes(['EEA', 'EEB', 'EEC', 'PEA', 'PEB', 'PEC', 'PED'], '204'), max: 120, inclus: true, regime: 'service', condition: "Maximum de service 120 °C en atmosphère sèche." }
    ]
  },
  1103: {
    ft: ft(38869), indice: 'S003',
    detail: 'FT PPG 54 ind. D, p. 1–2. CENTREPOX PZ EVO (40 µm), puis CENTRIFUGON EAP EVO (50 + 50 µm). Surfaces galvanisées (124) ou métallisées au zinc-aluminium (126), jusqu’à 120 °C en atmosphère sèche. Durcissement final de 7 jours à 20 °C et 50 % HR. Contrôler la rugosité et la préparation correspondantes à la nature de la couche métallique.',
    plages: [{
      codes: [...codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '124'), ...codes(['EIA', 'EIB', 'EID', 'PIA', 'PIB', 'PID'], '126')],
      max: 120, inclus: true, regime: 'service', condition: 'Maximum de service en atmosphère sèche sur les subjectiles métalliques spécifiés.'
    }]
  }
};
