# Sortie Corsair Strategy Guide (Upper Sectors: DABC)

> ⬅️ **[Sortie Strategy Guide (Lower Sectors: GEFH) is here](article_en.html?file=articles/sortie_corsair_lower_en.md)**

## Premise: Party Composition
The strategy described in this article assumes the following party composition:

* **Standard Setup**: `RUN COR BLM SCH SCH GEO`
* **Alternative (if short on jobs)**: `RUN COR BLM BLM SCH GEO`

The core strategy focuses on using **two Scholars** to create skillchains and dealing massive damage through Magic Bursts (MB).

> **💡 Note on GEO's Indi-Spells**
> In boss battles, the Geomancer basically uses **"Indi-Acumen"** to boost the party's overall magic power. However, depending on the setup, they may choose **"Indi-Haste."** This is used not so much for attack speed but to **speed up the recast of spells like elemental magic to increase rotation speed.** It's key to switch flexibly according to the situation.

<a id="timing-of-skillchain-follow-up-ws"></a>
### 【Important】 Timing of Skillchain Follow-up WS

Skillchains created by Scholars using **books (Stratagems)** have a unique characteristic: the **skillchain window (reception time) is longer than usual.**

Therefore, if a Corsair panics and fires a follow-up WS while the Scholar's skillchain effect is still active, it will overwrite and shorten the window where the Scholar could have landed multiple Magic Bursts (MB), which is a huge waste.

* **Best Timing**: The ideal time to fire the WS is at the very end, **"just as the previous skillchain effect has completely disappeared."**
* **Compromise**: If you are worried about the skillchain breaking, you can aim for **"just before the effect disappears."**

Instead of firing immediately in a hurry, keep in mind to **"wait a breath after seeing the effect"** before shooting. This will significantly increase the party's total damage!

<div class="boss-box" id="leaden-macro">

### 💡 Solo Skillchain Macro: "Leaden Salute → Wildfire"

A 5-line macro to further extend the Scholar's Distortion skillchain (for Ice/Water MB) and maximize MB time.

#### Macro Configuration (5 lines)
```text
1. /equipset [Quick Draw STP Gear]
2. /ws "Leaden Salute" <t> <wait4>
3. /ja "Ice Shot" <t> <wait1>
4. /ja "Ice Shot" <t> <wait2>
5. /ws "Wildfire" <t>
```

#### Commentary
*   **Solo Skillchain (Darkness Continuity)**:
    By timing <span class="ws-highlight">Leaden Salute</span> with the Scholar's "Distortion" to create a **Darkness** skillchain, and then following up with <span class="ws-highlight">Wildfire</span>, you can generate **another "Darkness"** skillchain. This greatly extends the MB window.
*   **Choice of Shots (Important)**:
    This macro includes two "<span class="ability-highlight">Ice Shots</span>" between WS. This is to instantly secure the TP needed for the next WS by utilizing effects like **Rostam (Path B)**'s "Quick Draw: TP+250."
    *Note: Shots like Light Shot do not grant TP, so it's key to choose an effective shot.*
    > 💡 **Regarding Elemental Attributes**
    > The above example assumes "Ice weakness (Ice MB)." If the enemy is weak to Water (Water MB), swap to "Water Shot" flexibly according to the boss's weakness.

*   **Exquisite Wait Settings (The Golden Ratio)**:
    The wait times in this macro are filled with "dedication to stable skillchains" derived from numerous boss battles.
    *   **`<wait4>` (After Leaden)**:
        We initially used 5 seconds, but depending on the landing timing, the subsequent Wildfire sometimes failed to connect. We set it to **4 seconds** for stability.
    *   **`<wait2>` (After the 2nd Shot)**:
        Normally 1 second would suffice, but based on a past experience where it failed once, we set it to **2 seconds** to eliminate the risk of failure.
*   **Why use STP gear for Leaden?**:
    The reason for swapping to "Quick Draw STP gear" in the first line is to prioritize **successfully completing the skillchain by ensuring 1000 TP is regained with two shots**, even if it slightly reduces the damage of Leaden itself.

</div>

<div class="boss-box" id="laststand-macro">

### 💡 For Ultimate Skillchain "Radiance": Last Stand 2-Button Macro

Explanation of the "Two-button (Split)" macro technique used to generate the ultimate skillchain "Radiance" solo from a Scholar's Fragmentation skillchain.

#### Macro 1 (The Trigger)
```text
1. /equipset [Last Stand R.Acc Focus]
2. /ws "Last Stand" <t>
```
*   First, use this macro timed with the Scholar's "Fragmentation" to generate a **"Light"** skillchain.
*   Assuming high-evasion bosses, we use **R.Acc-focused gear** to "ensure it hits" rather than focusing on damage.

#### Macro 2 (The Finisher)
```text
1. /equipset [Quick Draw STP Gear]
2. /ja "Thunder Shot" <t> <wait1>
3. /ja "Thunder Shot" <t> <wait2>
4. /equipset [Last Stand R.Acc Focus]
5. /ws "Last Stand" <t>
```
*   **Why "Two Buttons"?**:
    Including gear swaps, the series of actions to generate Radiance totals **7 lines**. Since FFXI macros are limited to 6 lines, it must be physically split into two.
*   **Timing Tip**:
    After generating the "Light" skillchain with Macro 1, it's ideal to trigger Macro 2 **just before the Light effect disappears.**
*   **Wait Settings after Shots (Flexible choice)**:
    We set the wait after the 2nd shot in Macro 2 to `<wait1>` (or `<wait2>`).
    Unlike the Leaden-Wildfire macro, this one includes an `equipset` command after the 2nd shot, creating a slight buffer. Therefore, depending on your connection, `<wait1>` is less likely to fail, allowing for a stable finishing Last Stand.

</div>

### NM Kill Order
In this strategy route, we kill bosses in the following order, considering trigger collection and movement efficiency:
* **Upper Sectors (Lower Bosses)**: **D** → **A** → **B** → **C**
* **Lower Sectors (Higher Bosses)**: **G** → **E** → **F** → **H**

> **💡 Advantage of this Route (Follow the Left Wall)**
> The biggest advantage of rotating the upper sectors in the "D→A→B→C" order is that **after defeating the first D boss, you can reach the final C boss without getting lost just by following the "left wall."** This is a highly recommended route even for those unfamiliar with Sortie maps.

## Initial Buffing (In front of the Device)

After entering Sortie, everyone buffs in front of the first device (warp point).
The Corsair's crucial role here is **recovering abilities with Random Deal** to distribute the Geomancer's "**Entrust** (**Indi-Haste**)" to both the Rune Fencer and the Corsair.

### Buffing Procedure

1. **Check GEO's Actions**
    The GEO uses no other abilities and first uses **"Entrust + Indi-Haste" on the Tank (RUN)**.
2. **Corsair's Roll (1st)**
    While the GEO is applying Entrust-Haste, the Corsair uses **"Crooked Cards + Samurai Roll."**
3. **Random Deal for Ability Recovery**
    Once you confirm Entrust has landed on the RUN, the Corsair uses **"Random Deal"** to recover the GEO's Entrust recast.
4. **Entrust-Haste on Corsair**
    The GEO, with Entrust recovered, now uses **"Entrust + Indi-Haste" on the Corsair**.
5. **Corsair's Roll (2nd)**
    Phantom Roll recast should also be recovered by Random Deal.
    * If "**Crooked Cards**" was recovered: **"Crooked Cards + Fighter's Roll"**
    * If not recovered: Just **"Fighter's Roll"**

Once this is done, the Corsair's initial preparation is complete.

### Crucial Buffs from the Scholar (Haste & Darkness Storm)

In addition to the interaction with the GEO, always make sure to get **"Haste"** and **"Animus Tyranni (Darkness Storm)"** from the Scholar.
Getting these provides the following major benefits:

* **Haste**: Reduces attack interval, allowing even a Corsair with **Budget Gear** to successfully pull off a solo skillchain in time.
  > 💡 **Note on Aura**
  > In a "Two Scholars" setup, one Scholar typically uses the SP ability "Tabula Rasa" to spread a powerful **"Aura"** during initial buffs. Therefore, the Haste slot (interval reduction) is usually not an issue in the early stages.
* **Darkness Storm**: Significantly increases the damage of <span class="ws-highlight">Leaden Salute</span> (Darkness attribute), which is the Corsair's main magic WS. (Crucial for utilizing elemental obis).

If these buffs are missing (e.g., after Aura expires), don't hesitate to ask the Scholar: "Haste and Dark Storm, please!" This is a key tip for maintaining damage and skillchain success.

---

## Post-Buff Party Split and Solo Actions

After initial buffs, the party splits into three groups to handle gimmicks (chest spawning) in each sector.

### Party Movement & Roles
* **Rune Fencer & Black Mage (Sector D)**
  The RUN heads toward the D boss room and handles 3 Fomors solo. The BLM also heads toward D and handles 3 Acuefs on the way. The BLM finishes earlier and then supports the RUN with Fomors.
* **2 Scholars & Geomancer (Sector C)**
  These three head to Sector C to defeat 6 Kurs.
* **Corsair (Sector B)**
  The Corsair goes solo to Sector B to defeat 6 Elementals to spawn a chest.

> **💡 Efficiency Note**
> By splitting into three groups from the start, you can **collect triggers for all Upper NM bosses (A-D) simultaneously**, allowing for extremely efficient progress in the time-limited Sortie.

### How to Kill Elementals (Solo Skillchain)
When killing elementals, melee with a dagger to quickly gain TP and handle them with the following "Solo Skillchain (Darkness)":

1. **<span class="ws-highlight">Leaden Salute</span>** (Use Magic WS gear)
2. **<span class="ws-highlight">Viper Bite</span>** (Stay in melee TP gear)
3. **<span class="ws-highlight">Leaden Salute</span>** (Swap back to Magic WS gear → **Darkness Skillchain**)

With decent gear, this series of skillchains alone can finish an elemental. If some HP remains, use <span class="ability-highlight">Quick Draw</span> or another <span class="ws-highlight">Leaden Salute</span> to finish it off.

### Post-Kill Actions and Regrouping
1. **Tactician's Roll and Chests**
    Defeating 6 elementals spawns 2 chests.
    A crucial point here is to **use "Tactician's Roll" immediately after killing the 6th elemental** (to accumulate TP while moving to the boss). Open the 2 chests after rolling.
2. **Move to the Starting Device**
    After opening chests, warp from the Sector B device to the starting device (**Device #0**).
3. **Regroup with Sector C Group (SCHs & GEO)**
    By then, the group from Sector C should be returning. Once they regroup at Device #0, apply **"Bolter's Roll"** to everyone and head to the Sector D boss together.

---

<div class="boss-box">

## Sector D Boss Guide: Degei

### Preparation and Start (Cut Cards)

By the time you reach the D boss room, your Phantom Rolls should be "Tactician's Roll" and "Bolter's Roll."

1. **Fold and Re-roll**
    Before combat, use the ability **"Fold"** to remove the no-longer-needed Bolter's Roll (the last roll used). In the empty slot, use **"Wizard's Roll"** to boost the party's magic power.
2. **Initial SP Ability Synergy (Cut Cards on RUN)**
    Start combat once ready. At the start, the RUN uses the SP ability "**Odyllic Subterfuge (Subterfuge)**" for powerful debuffing and hate generation.
    The Corsair should **use their SP ability "Cut Cards" on the RUN as soon as they use "Subterfuge."** (This reduces the RUN's SP recast, allowing them to use it again for later bosses).

### Skillchains and Follow-up Patterns for Degei

The Sector D boss (Degei) has a gimmick where its weakness attribute changes randomly. You can identify the weakness by the **type of special moves** it uses after some attacks. Once the weakness is known, the Scholar will start creating skillchains. Here are the **follow-up patterns for the Corsair to increase damage**:

#### ① Weak to Fire (Liquefaction → Fusion → Light)
* **SCH Action**: Create a "Liquefaction" to "Fusion" skillchain.
* **COR Action**:
  1. Watch the SCH's "Fusion" skillchain. If it seems the boss won't be defeated, follow up with the dagger Merit WS **"<span class="ws-highlight">Exenterator</span>."** This generates a **Light** skillchain.
  2. After generating Light, immediately fire a **"Fire Shot" with CS Boots (Empyrean feet)** equipped to amplify the damage of the SCH's subsequent Magic Burst (MB).
  3. **(Additional follow-up)**: If the boss still stands, the **RUN can follow up with "<span class="ws-highlight">Dimidiation</span>"** to generate another **Light** skillchain.

> **💡 Tip (Accuracy Gear)**
> <span class="ws-highlight">Exenterator</span> is a physical WS; it must hit to connect the skillchain. Once fire weakness is confirmed, swap to **"Accuracy (Melee TP) gear"** and stand by.

#### ② Weak to Thunder or Wind (Fragmentation → Light → Radiance)
* **SCH Action**: Create a "Fragmentation" skillchain (A single Fragmentation using a book, not a 2-step SC).
* **COR Action**:
    1. Timed with the SCH's "Fragmentation," the COR fires **"<span class="ws-highlight">Last Stand</span>"** to extend it to a **"Light"** skillchain.
    > 💡 **[See the Radiance macro explanation here](#laststand-macro)**
    2. Immediately after the Light SC, **fire 2 "<span class="ability-highlight">Quick Draws</span> (STP Gear)" to instantly regain TP.**
    3. Firing another **"<span class="ws-highlight">Last Stand</span>"** immediately will generate the ultimate skillchain **"Radiance."**

> **💡 Tip (R.Acc Focus)**
> The goal of <span class="ws-highlight">Last Stand</span> here is not damage but "ensuring it hits to connect/extend the skillchain." Use **"R.Acc-focused gear."**

#### ③ Weak to Ice or Water (Distortion → Darkness → Darkness)
* **SCH Action**: Create a "Distortion" skillchain.
* **COR Action**:
  1. Timed with the SCH's "Distortion," the COR fires **"<span class="ws-highlight">Leaden Salute</span>"** to extend it to a **"Darkness"** skillchain.
    > 💡 **[See the follow-up macro explanation here](#leaden-macro)**
  2. Immediately after the Darkness SC, fire **2 "<span class="ability-highlight">Quick Draws</span> (STP Gear)" to instantly regain TP.**
  3. Firing **"<span class="ws-highlight">Wildfire</span>"** immediately with the regained TP will generate **another "Darkness"** skillchain.

#### ④ Weak to Earth (Gravitation → Darkness)
* **SCH Action**: Create a "Gravitation" skillchain.
* **COR Action**:
  Basically, **the COR stands by (no action)**. The COR has no WS that can directly connect "Gravitation" to "Darkness."
* **Exception (Extension from RUN)**:
  If the RUN fires a WS against the SCH's "Gravitation" and connects it to a "Darkness" skillchain, a window opens. **The COR can immediately fire "<span class="ws-highlight">Wildfire</span>" against the RUN's Darkness SC** to generate **another "Darkness"** skillchain. (Rare pattern).

</div>

---

## Basic Post-Boss Movement (D Boss → A Boss)

After defeating a boss like Degei, immediately move to the next destination (Sector A). The basic routine is:

1. **Immediate Bolter's Roll**
   As soon as the boss dies, the COR uses **"Bolter's Roll"** to increase the party's movement speed.
2. **TP Security with Tactician's Roll**
   If you don't have enough TP after the battle, also use **"Tactician's Roll"** while moving. This ensures you have the TP needed for follow-ups at the next boss.
    > **💡 Tip**: Try to ensure the **RUN (Tank)** also gets this roll, as they need TP for hate-generating actions at the start of the next boss battle.
    > **【Arrival Switch】**: When you arrive, you'll have "Tactician + Bolter." Just overwrite Bolter with **"Wizard's Roll"** to enter combat with "Tactician + Wizard." (Folding is only necessary for the first D boss).
3. **Sneak & Invisible**
   While moving, the party usually gets **"AoE Sneak"** from the SCHs or GEO (sub-SCH). The COR should focus on distributing **Bolter's Roll** first, then move once everyone has Sneak.

### On the way to A Boss (NM Kill and Re-applying Bolter)

If the **NM in Sector A** is up on the way to the boss, kill it. There is a crucial habit for the COR here:

> **💡 Important: Bolter's Roll loss and Re-application**
> <span class="ability-highlight">Bolter's Roll</span> is lost if a character enters "Combat Status" (attacking or being attacked). After fighting an NM or if someone is aggroed, you must re-apply Bolter's Roll.
>
> However, **if the COR themselves was not attacked (did not enter combat status), the Bolter's Roll remains on them.** If you try to use it again in this state, it will say "no effect (cannot overwrite)," and you cannot give it to your allies.
>
> **Counter-Technique**:
> When you need to re-apply Bolter to allies, the COR should **intentionally enter combat status by firing a <span class="ability-highlight">Quick Draw</span> at an enemy to clear their own Bolter**, then use **"Bolter's Roll"** again for everyone!

---

<div class="boss-box">

## Sector A Boss Guide: Ghatjot

Upon arrival, switch to <span class="ability-highlight">Wizard's Roll</span> and start combat. Ghatjot is basically defeated using **Fire Magic Bursts (SCH Fire SC)**.

* **SCH Action**: Create a "Liquefaction" to "Fusion" skillchain.
* **COR Action (Follow-up)**:
  Exactly the same as the "Weak to Fire" pattern for Degei. Watch the Fusion SC damage, follow up with **"<span class="ws-highlight">Exenterator</span>" for a Light SC** if needed, and let the RUN follow up with "<span class="ws-highlight">Dimidiation</span>" if it still lives. (Stand by in Melee Accuracy gear).

</div>

---

<div class="boss-box">

## Sector B Boss Guide: Leshonn

After Sector A, move to the Sector B boss room with <span class="ability-highlight">Bolter's Roll</span> and AoE Sneak. Upon arrival, use **"Crooked Cards + Wizard's Roll"** to further boost magic damage.

### Boss Attribute (Thunder or Wind)
Leshonn will be either **Thunder** or **Wind** attribute. Unlike Degei's pure randomness, it's a 50/50 choice, but you won't know until you start combat.

### Skillchains and COR Follow-up
Once the attribute is known, the Scholar creates a skillchain. The COR's follow-ups are the same as described for Degei:

* **Thunder Boss (Earth Weakness): Gravitation**
  SCH creates "Gravitation" for <span class="magic-highlight">Stone MB</span>. COR basically stands by, but can follow up with "<span class="ws-highlight">Wildfire</span>" if the RUN creates a Darkness SC.
* **Wind Boss (Ice Weakness): Distortion**
  SCH creates "Distortion" for <span class="magic-highlight">Blizzard MB</span>. COR follows the **Leaden (Darkness) → Shots → Wildfire (Darkness)** route.
    > 💡 **[See follow-up macro here](#leaden-macro)**

</div>

---

<div class="boss-box">

## Sector C Boss Guide: Skomora

After Sector B, move to Sector C boss with the same procedure.

### C Boss Weakness and Follow-up
Skomora is fixed to **Fire Weakness**, just like Ghatjot.

* **SCH Action**: Create "Liquefaction" to "Fusion" for <span class="magic-highlight">Fire MB</span>.
* **Magic Power Support via Debuffs**
  In the C boss battle, it's crucial for the BLM or SCH to land **"Impact"** and for the BLM to maintain **"Burn"** to lower the enemy's INT. This stabilizes MB damage for a smooth kill.
* **COR Action (Follow-up)**:
  Exactly the same as the **Fire Weakness Pattern**. Watch the Fusion SC, follow up with **"<span class="ws-highlight">Exenterator</span>" (Light SC)** from melee accuracy gear, and let the RUN follow up with Dimidiation if needed.

</div>

---

> ➡️ **[Sortie Strategy Guide (Lower Sectors: GEFH) is here](article_en.html?file=articles/sortie_corsair_lower_en.md)** ｜ 🏠 **[Back to Homepage](index_en.html)** ｜ ⬆️ **[Back to Top](#)**
