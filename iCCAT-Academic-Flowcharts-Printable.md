# iCCAT Academic Flowcharts - Printable Edition
## Interactive Campus Companion & Assistance Terminal

This document contains comprehensive, academic-style flowcharts for the iCCAT system. Each diagram follows a structured linear progression, using binary decisions only, and follows the university's prescribed visual format.

---

## User Perspective Flowcharts

### User Flow 1: Main Session Overview
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    classDef labelStyle fill:#4b5563,stroke:#374151,color:#fff,stroke-width:1px
    
    START([START]) --> HOME[/HOME PAGE/]
    HOME --> SELECT[SELECT FEATURE]
    
    SELECT --> NAV_L[Navigation]
    SELECT --> EVT_L[Events]
    SELECT --> STF_L[Staff]
    SELECT --> ABT_L[About]
    SELECT --> FDB_L[Feedback]
    
    NAV_L --> A((A))
    EVT_L --> B((B))
    STF_L --> C((C))
    ABT_L --> D((D))
    FDB_L --> E((E))
    
    A --> END([END])
    B --> END
    C --> END
    D --> END
    E --> END

    class START,END startEnd
    class HOME display
    class SELECT action
    class A,B,C,D,E connector
    class NAV_L,EVT_L,STF_L,ABT_L,FDB_L labelStyle
```

### User Flow 2: Section A - Campus Navigation Page
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    A((A)) --> NAV[NAVIGATION PAGE]
    NAV --> SEARCH[SEARCH BUILDING]
    SEARCH --> BLDG[/BUILDING INFO PAGE/]
    
    BLDG --> VIEW_TYPE{View Floor Plan?}
    VIEW_TYPE -->|Yes| FLR[FLOOR PLAN VIEWER]
    VIEW_TYPE -->|No| DIR[ROUTE GENERATOR]
    
    FLR --> INDOOR[INDOOR PATHFINDING]
    INDOOR --> DIR
    
    DIR --> TRAV_TYPE{Is Driving?}
    TRAV_TYPE -->|Yes| DRV[DRIVING ROUTE WITH PARKING]
    TRAV_TYPE -->|No| WALK_TYPE{Is Accessible?}
    
    WALK_TYPE -->|Yes| PWD[PWD ACCESSIBLE ROUTE]
    WALK_TYPE -->|No| WALK[WALKING ROUTE]
    
    DRV --> ROUTE[/MAP ROUTE DISPLAY/]
    PWD --> ROUTE
    WALK --> ROUTE
    
    ROUTE --> QR[GENERATE MOBILE QR CODE]
    QR --> FINISH([FINISH])

    class FINISH startEnd
    class NAV,BLDG,ROUTE display
    class SEARCH,FLR,INDOOR,DIR,DRV,PWD,WALK,QR action
    class VIEW_TYPE,TRAV_TYPE,WALK_TYPE decision
```

### User Flow 3: Section B - Events & Announcements Page
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    B((B)) --> EVENTS[EVENTS PAGE]
    EVENTS --> VIEW_MODE{Use Calendar View?}
    VIEW_MODE -->|Yes| CAL[CALENDAR GRID]
    VIEW_MODE -->|No| LST[CHRONOLOGICAL LIST]
    
    CAL --> SEL[SELECT EVENT]
    LST --> SEL
    SEL --> DETAILS[/EVENT DETAILS PAGE/]
    
    DETAILS --> NAV_CHECK{Need Directions?}
    NAV_CHECK -->|Yes| A((A))
    NAV_CHECK -->|No| FINISH([FINISH])

    class FINISH startEnd
    class EVENTS,DETAILS display
    class CAL,LST,SEL action
    class VIEW_MODE,NAV_CHECK decision
```

### User Flow 4: Section C - Staff Directory Page
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    C((C)) --> STAFF[STAFF DIRECTORY PAGE]
    STAFF --> SEARCH_METHOD{Search by Name?}
    SEARCH_METHOD -->|Yes| NAME[SEARCH BY NAME]
    SEARCH_METHOD -->|No| DEPT_CHECK{Filter by Dept?}
    
    DEPT_CHECK -->|Yes| DEPT[FILTER BY DEPARTMENT]
    DEPT_CHECK -->|No| BLDG[FILTER BY BUILDING]
    
    NAME --> LST[STAFF LIST DISPLAY]
    DEPT --> LST
    BLDG --> LST
    LST --> PROF[/STAFF PROFILE PAGE/]
    
    PROF --> NAV_CHECK{Need Directions?}
    NAV_CHECK -->|Yes| A((A))
    NAV_CHECK -->|No| FINISH([FINISH])

    class FINISH startEnd
    class STAFF,PROF display
    class NAME,DEPT,BLDG,LST action
    class SEARCH_METHOD,DEPT_CHECK,NAV_CHECK decision
```

### User Flow 5: Section D - About Page
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    D((D)) --> ABT[ABOUT PAGE]
    ABT --> VIEW_FEAT{View Features?}
    VIEW_FEAT -->|Yes| FEAT[SYSTEM FEATURES LIST]
    VIEW_FEAT -->|No| GUIDE[USAGE GUIDE TUTORIAL]
    
    FEAT --> FINISH([FINISH])
    GUIDE --> FINISH

    class FINISH startEnd
    class ABT display
    class FEAT,GUID eaction
    class VIEW_FEAT decision
```

### User Flow 6: Section E - Feedback System Page
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    
    E((E)) --> FEEDBACK[FEEDBACK SYSTEM PAGE]
    FEEDBACK --> RATE[RATE CATEGORIES 1-9]
    RATE --> COMM[ADD OPTIONAL COMMENTS]
    COMM --> SUBMIT[SUBMIT FEEDBACK FORM]
    SUBMIT --> THANK[/THANK YOU PAGE/]
    THANK --> FINISH([FINISH])

    class FINISH startEnd
    class FEEDBACK,THANK display
    class RATE,COMM,SUBMIT action
```

---

## Admin Perspective Flowcharts

### Admin Flow 1: System Management Dashboard
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    classDef labelStyle fill:#4b5563,stroke:#374151,color:#fff,stroke-width:1px

    START([START]) --> LOGIN[ADMIN LOGIN PAGE]
    LOGIN --> AUTH{Valid Credentials?}
    AUTH -->|No| LOGIN
    AUTH -->|Yes| DASH[ADMIN DASHBOARD]
    
    DASH --> SELECT[SELECT MODULE]
    
    SELECT --> MOD_BLD[Buildings]
    SELECT --> MOD_PTH[Paths]
    SELECT --> MOD_FLR[Floor Plans]
    SELECT --> MOD_STF[Staff]
    SELECT --> MOD_EVT[Events]
    SELECT --> MOD_ANA[Analytics]
    
    MOD_BLD --> M_A((M_A))
    MOD_PTH --> M_B((M_B))
    MOD_FLR --> M_C((M_C))
    MOD_STF --> M_D((M_D))
    MOD_EVT --> M_E((M_E))
    MOD_ANA --> M_F((M_F))
    
    M_A --> DASH
    M_B --> DASH
    M_C --> DASH
    M_D --> DASH
    M_E --> DASH
    M_F --> DASH
    
    DASH --> EXIT_CHECK{Logout?}
    EXIT_CHECK -->|Yes| FINISH([FINISH])
    EXIT_CHECK -->|No| SELECT

    class START,FINISH startEnd
    class LOGIN,DASH display
    class SELECT action
    class AUTH,EXIT_CHECK decision
    class M_A,M_B,M_C,M_D,M_E,M_F connector
    class MOD_BLD,MOD_PTH,MOD_FLR,MOD_STF,MOD_EVT,MOD_ANA labelStyle
```

### Admin Flow 2: Module Details (Sub-Flows)
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    MA((M_A)) --> BLD_ACT{Add or Edit?}
    BLD_ACT -->|Add| B_ADD[Create New Building]
    BLD_ACT -->|Edit| B_EDT[Update Existing Building]
    B_ADD --> B_SAVE[Save to Firebase]
    B_EDT --> B_SAVE
    
    MB((M_B)) --> PTH_ACT{Add or Edit?}
    PTH_ACT -->|Add| P_ADD[Draw New Path]
    PTH_ACT -->|Edit| P_EDT[Modify Path Waypoints]
    P_ADD --> P_SAVE[Save to Firebase]
    P_EDT --> P_SAVE
    
    MC((M_C)) --> FLR_ACT{Upload Plan?}
    FLR_ACT -->|Yes| F_UPL[Upload Floor Plan Image]
    FLR_ACT -->|No| F_MAN[Manage Indoor Nodes]
    F_UPL --> F_SAVE[Save to Firebase]
    F_MAN --> F_SAVE
```

---

## Kiosk System Flowcharts

### System Flow 1: Kiosk Operational Loop
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    START([BOOT SYSTEM]) --> SYNC[SYNC FIREBASE DATA]
    SYNC --> IDLE[/SCREENSAVER ACTIVE/]
    
    IDLE --> TOUCH{User Touch?}
    TOUCH -->|Yes| SESSION[START USER SESSION]
    TOUCH -->|No| IDLE
    
    SESSION --> TIMEOUT{Inactivity?}
    TIMEOUT -->|Yes| IDLE
    TIMEOUT -->|No| SESSION
    
    class START startEnd
    class IDLE display
    class TOUCH,TIMEOUT decision
```
