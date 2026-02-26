# Quick Translator – Pomysły na ulepszenia 🚀

> Cel: zrobić z tego **najlepsze** narzędzie do nauki języków z filmów, stron i social media.

---

## 1. 🧠 Spaced Repetition (powtórki rozłożone w czasie)

**Co:** Wbudowany system fiszek z algorytmem SM-2 (jak Anki, ale bez wychodzenia z przeglądarki).

**Jak:**

- Po zapisaniu słowa/zdania automatycznie trafia do kolejki powtórek
- Popup pokazuje ile słów do powtórki dziś: `🔔 12 słów czeka`
- Mini-quiz w popupie: pokazuje słowo → użytkownik zgaduje → ocenia się 1-5
- Interwały rosną: 1d → 3d → 7d → 14d → 30d → 90d
- Powiadomienia Chrome: "Masz 8 słów do powtórki!"

**Przykład UI w popupie:**

```
┌─────────────────────────────┐
│  🧠 Powtórka dnia (8/23)   │
│                             │
│  "ubiquitous"               │
│  ▸ Pokaż odpowiedź          │
│                             │
│  → "wszechobecny"           │
│  [Łatwe] [OK] [Trudne]      │
└─────────────────────────────┘
```

---

## 2. 📊 Dashboard statystyk nauki

**Co:** Strona/panel ze szczegółowymi statystykami postępów.

**Jak:**

- Heatmapa aktywności (jak GitHub contributions) – ile słów dziennie
- Wykres: poznane słowa w czasie (linia rosnąca)
- Podział wg języka: EN 340 słów, DE 45 słów, ES 12 słów
- Streak counter: "🔥 14 dni z rzędu!"
- Poziom trudności słów (jednosylabowe vs wielosylabowe)
- Statystyki z filmów: "Z Netflixa nauczyłeś się 120 słów"

---

## 3. 🎯 Kontekstowe przykłady zdań (Sentence Mining)

**Co:** Przy każdym zapisanym słowie automatycznie zbierać 2-3 przykładowe zdania z kontekstu.

**Jak:**

- Przy hover/click na słowo w napisach → zapisuje zdanie + timestamp filmu
- Przy powtórce fiszki pokazuje zdanie z dziurą: `"The weather was _____ today"` → "beautiful"
- Klikając na przykład → otwiera Netflix/YT w tym momencie filmu (deep link z timestampem)
- Zbierać zdania z wielu źródeł (ten sam wyraz z 3 różnych filmów = lepsze zapamiętanie)

---

## 4. 🗣️ Tryb shadowing / wymowa

**Co:** Aktywne ćwiczenie wymowy przy oglądaniu filmów.

**Jak:**

- Klawisz `R` = nagraj swoją wymowę mikro (Web Audio API / MediaRecorder)
- Odtwarza nagranie obok oryginału → porównaj
- Wizualizacja waveform: twoja vs oryginał (proste porównanie)
- Tryb auto-pauza: po każdym napisie film pauzuje, czeka aż powtórzysz
- Opcjonalnie: Web Speech Recognition API → sprawdza czy powiedziałeś poprawnie
- Scoring: "Wymowa: 87% zgodności"

**Przykład flow:**

```
1. Napis: "I can't believe you did that"
2. Film pauzuje automatycznie
3. [🎤 Nagraj] → użytkownik mówi
4. [▶ Porównaj] → odtwarza oryginał i nagranie
5. ✅ "Great!" lub 🔄 "Spróbuj ponownie"
```

---

## 5. 🏷️ Kategorie i tagi słów

**Co:** Organizacja zapisanych słów w foldery/tagi.

**Jak:**

- Auto-tagowanie: `#film:Breaking-Bad`, `#strona:bbc.com`, `#typ:idiom`
- Własne tagi: `#biznes`, `#podróże`, `#slang`
- Filtrowanie w popupie po tagach
- Auto-klasyfikacja części mowy: rzeczownik / czasownik / przymiotnik (API lub reguły)
- Grupowanie po tematach: jedzenie, emocje, praca, podróże

---

## 6. 🎮 Gamification – system motywacji

**Co:** Punkty, odznaki, poziomy, wyzwania.

**Jak:**

- XP za każde nowe słowo (+10), powtórkę (+5), shadowing (+15)
- Poziomy: Beginner → Intermediate → Advanced → Fluent → Native
- Odznaki: "🎬 Movie Buff" (100 słów z filmów), "📚 Bookworm" (500 słów), "🔥 30-day streak"
- Dzienne wyzwania: "Naucz się 10 nowych słów" / "Powtórz 20 fiszek"
- Weekly challenge: "Obejrzyj 1 odcinek z napisami i zapisz 15 słów"
- Pasek postępu w popupie: `Level 7 ████████░░ 340/500 XP`

---

## 7. 🔤 Podwójne napisy (dual subtitles)

**Co:** Wyświetlanie napisów w dwóch językach jednocześnie na Netflix/YT.

**Jak:**

- Górna linia: oryginał (EN), dolna linia: tłumaczenie (PL) — mniejszą czcionką
- Toggle klawiszem `T` — włącz/wyłącz drugie napisy
- Kliknięcie na słowo w obu liniach → tłumaczenie + wymowa
- Opcja: ukryj tłumaczenie domyślnie, pokaż po najechaniu myszką (aktywna nauka)
- Highlight odpowiadających słów w obu językach (word alignment)

**Przykład na ekranie:**

```
        I can't believe you did that
     Nie mogę uwierzyć, że to zrobiłeś     ← mniejsza, szara czcionka
```

---

## 8. 📝 Tryb "czytanie aktywne" na stronach WWW

**Co:** Specjalny tryb do czytania artykułów (BBC, Reddit, blogi) z interaktywną nauką.

**Jak:**

- Klawisz `Ctrl+Shift+L` = włącz tryb nauki na stronie
- Automatycznie podkreśla trudne/nieznane słowa (na podstawie listy częstotliwości)
- Hover → tłumaczenie, click → fiszka + kontekst
- Znane słowa (już w bazie) mają delikatne ✓ obok
- Nowe słowa → kolorowe podkreślenie (zielone = łatwe, żółte = średnie, czerwone = trudne)
- Na końcu artykułu: "Poznałeś 7 nowych słów z tego artykułu! 🎉"

---

## 9. 📱 Sync & eksport zaawansowany

**Co:** Synchronizacja słów między urządzeniami + lepszy eksport.

**Jak:**

- Sync przez Chrome Storage Sync (już jest) → rozszerzyć o pełną bazę
- Eksport do: **Anki** (już jest ✅), **Quizlet**, **Memrise**, **Notion**, **Google Sheets**
- Import słów z pliku CSV/JSON (np. z innej aplikacji)
- Backup/restore jednym kliknięciem
- API endpoint (opcjonalne): webhook → wysyła nowe słowa do Notion/Airtable automatycznie
- Generowanie PDF z listą słów + przykładami do druku

---

## 10. 🤖 AI-powered features (GPT/LLM)

**Co:** Integracja z AI do głębszego uczenia.

**Jak:**

- Po kliknięciu słowa → "Wyjaśnij" → GPT tłumaczy niuanse, synonimy, użycie
- "Utwórz zdanie" → AI generuje 3 przykładowe zdania z tym słowem
- "Czym się różni X od Y?" → porównanie synonimów (np. "big" vs "large" vs "huge")
- Gramatyka kontekstowa: kliknij zdanie → AI wyjaśnia czas, konstrukcję
- Personalizowany plan nauki: "Na twoim poziomie skup się na tych 20 słowach"
- Idiom explainer: "break a leg" → dosłownie vs znaczenie przenośne

**Przykład tooltipa:**

```
┌─────────────────────────────────┐
│ EN → PL                    [💾] │
│ "ubiquitous" → "wszechobecny"  │
│                                 │
│ 🤖 AI Insight:                  │
│ Formalne słowo, częste w        │
│ tekstach naukowych i tech.      │
│ Synonimy: pervasive, omnipresent│
│ Poziom: C1                      │
│                                 │
│ 📝 "Smartphones have become     │
│     ubiquitous in modern life." │
└─────────────────────────────────┘
```

---

## 11. ⌨️ Skróty klawiszowe – rozszerzony zestaw

**Co:** Więcej skrótów do szybkiej nauki bez odrywania rąk od klawiatury.

| Klawisz        | Akcja                                     |
| -------------- | ----------------------------------------- |
| `1-5`          | Oceń trudność słowa (przy powtórce)       |
| `R`            | Nagraj wymowę (shadowing)                 |
| `T`            | Toggle podwójne napisy                    |
| `Q`            | Szybki quiz z aktualnego napisu           |
| `F`            | Zapisz do ulubionych                      |
| `Ctrl+Shift+L` | Tryb aktywnego czytania                   |
| `Space`        | Następna fiszka (w trybie powtórki)       |
| `N`            | Następny napis bez pauzy                  |
| `B`            | Dodaj zakładkę w filmie (bookmark moment) |

---

## 12. 🎬 Film mode – inteligentna nauka z filmów

**Co:** Zaawansowany tryb nauki specjalnie do oglądania filmów/seriali.

**Jak:**

- Panel boczny z listą wszystkich napisów (transkrypcja) — scrollowalna
- Kliknięcie na napis w panelu → film skacze do tego momentu
- Auto-highlight nowych słów w napisach (czerwone = nieznane, zielone = znane)
- "Vocabulary preview" przed odcinkiem: podgląd trudnych słów które się pojawią
- Po obejrzeniu: podsumowanie "W tym odcinku pojawiły się 23 nowe słowa"
- Historia odcinków: które filmy/odcinki obejrzałeś + ile słów z nich

---

## 13. 🌍 Obsługa większej liczby platform

**Co:** Rozszerzenie o więcej serwisów streamingowych i stron.

**Jak:**

- **Disney+** – napisy i hover-translate
- **HBO Max** – ten sam mechanizm co Netflix
- **Amazon Prime Video** – napisy w `<span>` → click/hover
- **Twitch** – tłumaczenie chatu na żywo
- **Spotify** (lyrics) – tłumaczenie tekstów piosenek
- **Kindle Cloud Reader** – tłumaczenie słów w e-bookach
- **Coursera / edX** – napisy wykładów + zapis słów academic

---

## 14. 🎨 Personalizacja UI

**Co:** Użytkownik sam konfiguruje wygląd i zachowanie.

**Jak:**

- Rozmiar czcionki napisów tłumaczenia (slider)
- Kolor highlight'u słów (color picker)
- Pozycja tooltipa: góra/dół/auto
- Motyw: ciemny (default) / jasny / auto (system)
- Opóźnienie hovera: 100ms-500ms (slider)
- Wybór czcionki dla napisów
- Opcja: auto-pauza przy hover (on/off)
- Opcja: auto-wymowa przy hover (on/off)
- Opacity podwójnych napisów (0% - 100%)

---

## 15. 📋 Quick Notes / Journal

**Co:** Notatnik do zapisywania uwag w trakcie nauki.

**Jak:**

- Klawisz `Ctrl+Shift+N` → otwiera mini-notatnik overlay
- Zapisuj kontekst: "W odcinku 3, scena w restauracji – idiomy o jedzeniu"
- Powiązanie z zapisanymi słowami i timestampami
- Eksport notatek jako Markdown
- Wyszukiwanie po notatkach

---

## Priorytety implementacji

| Priorytet | Funkcja                    | Trudność | Wpływ na naukę |
| --------- | -------------------------- | -------- | -------------- |
| 🔴 1      | Spaced Repetition (fiszki) | Średnia  | 🟢🟢🟢🟢🟢     |
| 🔴 2      | Podwójne napisy            | Średnia  | 🟢🟢🟢🟢🟢     |
| 🟡 3      | Dashboard statystyk        | Łatwa    | 🟢🟢🟢🟢       |
| 🟡 4      | Gamification               | Łatwa    | 🟢🟢🟢🟢       |
| 🟡 5      | Tryb shadowing             | Trudna   | 🟢🟢🟢🟢🟢     |
| 🟡 6      | Kategorie/tagi             | Łatwa    | 🟢🟢🟢         |
| 🔵 7      | AI features                | Trudna   | 🟢🟢🟢🟢🟢     |
| 🔵 8      | Film mode (panel boczny)   | Trudna   | 🟢🟢🟢🟢       |
| 🔵 9      | Aktywne czytanie           | Średnia  | 🟢🟢🟢🟢       |
| ⚪ 10     | Więcej platform            | Średnia  | 🟢🟢🟢         |

---

_Ostatnia aktualizacja: 2025-02-26_
