# SFZ Brand Assety

Tento adresár obsahuje oficiálne brand assety Slovenského futbalového zväzu, ktoré používame v rámci Asset Management projektu.

## Obsah

- `SFZ_Design-manual_2024-01.pdf` – Oficiálny SFZ Design Manual, edícia 2024-01, vypracovaný štúdiom **Codes Brand House**

## Použitie

Tieto assety sú **referenčné** – nepoužívajte ich priamo v kóde. Namiesto toho:

1. **Pre farby, typografiu a spacing** → použite design tokens z [`packages/design-tokens/`](../../../packages/design-tokens/)
2. **Pre logá v UI** → importujte SVG verzie z `packages/ui/src/assets/logos/` (TODO: pripraviť)
3. **Pre tlačové výstupy** (protokoly, faktúry) → použite vektorové PDF/EPS varianty (TODO: získať od SFZ)

## Brand farby v skratke

Pre rýchlu referenciu – plné špecifikácie nájdeš v `tokens.json`.

| Farba | HEX | PANTONE | Použitie |
|-------|-----|---------|----------|
| SFZ Blue | `#1450df` | 2935 C | Primárna brand farba |
| SFZ Red | `#ec1c24` | Warm Red C | Alerty, dôležité |
| SFZ Black | `#070504` | Black 6 C | Text na svetlom pozadí |
| Cool Grey 6 | `#bbbdbf` | Cool Grey 6 C | Svetlá sivá |
| Cool Grey 9 | `#808285` | Cool Grey 9 C | Stredná sivá |

## Varianty loga

Z design manuálu poznáme 4 hlavné varianty:

- **A variant** (základný) – kruhový s glóbusom a štátnym znakom → favicon, app icon
- **B variant** – vertikálny štít s glóbusom → kompaktné priestory
- **C variant** (vertikálny) – SFZ + nápis pod sebou → úzke priestory, login screen
- **D variant** (horizontálny) – SFZ + nápis vpravo → hlavičky, podpisy

**Ochranná zóna:** ¼ výšky/šírky loga zo všetkých strán pre A/B varianty, ½ pre C/D varianty.

## Licencia a copyright

Brand assety SFZ sú vlastníctvom Slovenského futbalového zväzu. Tento repozitár je open source pod MIT licenciou, ale **logá a brand prvky SFZ nie sú súčasťou MIT licencie** – ich použitie mimo tohto projektu vyžaduje samostatný súhlas SFZ.

Ak forkneš tento repozitár a chceš ho použiť pre vlastnú organizáciu:

1. Odstráň všetky SFZ logá a brand assety z `docs/assets/brand/`
2. Nahraď `tokens.json` vlastnými brand farbami
3. Nahraď logá v UI komponentoch

Viac informácií o copyright a brand pravidlách SFZ: [futbalsfz.sk](https://www.futbalsfz.sk)

## TODO

- [ ] Získať od SFZ vektorové SVG/EPS verzie logo variantov A, B, C, D
- [ ] Získať oficiálne fonty (ak používa SFZ konkrétny licencovaný typeface) – inak ostaneme pri Inter ako open-source alternatíve
- [ ] Pripraviť ikonografickú sadu (kompatibilná s lucide-react v UI)
- [ ] Pridať brand ilustrácie pre prázdne stavy (empty states) v aplikácii
