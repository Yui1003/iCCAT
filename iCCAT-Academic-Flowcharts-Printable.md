# iCCAT Academic Flowcharts - Printable Edition
## Interactive Campus Companion & Assistance Terminal

This document contains comprehensive, academic-style flowcharts for the iCCAT system. Each diagram follows a structured linear progression with clear, non-overlapping paths.

---

## User Perspective Flowcharts

### User Flow 1: Main Session Overview
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    START([START: User Approaches Kiosk]) --> HOME[/HOME PAGE/]
    HOME --> ACTION{Select Main Feature}
    
    ACTION -->|Campus Navigation| NAV((A))
    ACTION -->|Events & Announcements| EVT((B))
    ACTION -->|Staff Directory| STF((C))
    ACTION -->|About Kiosk| ABT((D))
    ACTION -->|How to Use| TTR[Interactive Tutorial]
    
    TTR --> HOME
    NAV --> END([END: Session Complete])
    EVT --> END
    STF --> END
    ABT --> END

    class START,END startEnd
    class NAV,EVT,STF,ABT connector
    class HOME,TTR display
    class ACTION decision
```

### User Flow 2: Section A - Campus Navigation
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    A((A)) --> NAV[NAVIGATION PAGE]
    
    NAV --> SEARCH_TYPE{Search/Browse?}
    SEARCH_TYPE -->|Search| SRCH[Enter Name/Type]
    SEARCH_TYPE -->|Browse| MAP[Pan/Zoom Map]
    SEARCH_TYPE -->|Filter| FILT[POI Category Filter]
    
    SRCH --> BLDG[Select Building]
    MAP --> BLDG
    FILT --> BLDG
    
    BLDG --> INFO[/BUILDING INFO PAGE/]
    INFO --> ACT_TYPE{Next Action?}
    
    ACT_TYPE -->|View Floors| FLR[Floor Plan Viewer]
    ACT_TYPE -->|Get Directions| DIR[Route Generator]
    
    FLR --> INDOOR[Indoor Pathfinding]
    DIR --> MODE{Travel Mode?}
    
    MODE -->|Walking| WK[Walking Path]
    MODE -->|Driving| DR[Driving Path with Parking]
    MODE -->|Accessible| PW[PWD Accessible Path]
    
    WK --> ROUTE[/MAP ROUTE DISPLAY/]
    DR --> ROUTE
    PW --> ROUTE
    
    ROUTE --> QR[Generate Mobile QR]
    QR --> FEEDBACK((E))
    FEEDBACK --> FINISH([FINISH])

    class FINISH startEnd
    class NAV,INFO,ROUTE,QR display
    class SEARCH_TYPE,ACT_TYPE,MODE decision
```

### User Flow 3: Section B - Events & Announcements
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    B((B)) --> EVENTS[EVENTS PAGE]
    EVENTS --> VIEW{Select View}
    
    VIEW -->|Calendar| CAL[Monthly Grid]
    VIEW -->|List| LST[Chronological List]
    
    CAL --> SEL[Select Date/Event]
    LST --> SEL
    
    SEL --> DET[/EVENT DETAILS PAGE/]
    DET --> OPT{Actions}
    
    OPT -->|Navigate| NAV((A))
    OPT -->|Back| EVENTS
    
    NAV --> FINISH([FINISH])

    class FINISH startEnd
    class EVENTS,CAL,LST,DET display
    class VIEW,OPT decision
```

### User Flow 4: Section C - Staff Directory
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    C((C)) --> STAFF[STAFF DIRECTORY]
    STAFF --> FILT{Search Method}
    
    FILT -->|Name| SN[Search by Name]
    FILT -->|Dept| SD[Filter by Department]
    FILT -->|Bldg| SB[Filter by Building]
    
    SN --> LST[Staff List/Grid]
    SD --> LST
    SB --> LST
    
    LST --> SEL[Select Staff Member]
    SEL --> PROF[/STAFF PROFILE PAGE/]
    
    PROF --> OPT{Actions}
    OPT -->|Navigate| NAV((A))
    OPT -->|Back| STAFF
    
    NAV --> FINISH([FINISH])

    class FINISH startEnd
    class STAFF,LST,PROF display
    class FILT,OPT decision
```

### User Flow 5: Section E - Feedback System
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    E((E)) --> FEEDBACK[FEEDBACK PAGE]
    FEEDBACK --> RATE[Rate Categories 1-9]
    RATE --> COMM[Add Optional Comments]
    COMM --> SUBMIT[Submit Feedback]
    SUBMIT --> CONFIRM[/THANK YOU PAGE/]
    CONFIRM --> FINISH([FINISH])

    class FINISH startEnd
    class FEEDBACK,CONFIRM display
```

---

## Admin Perspective Flowcharts

### Admin Flow 1: System Management
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    START([START]) --> LOGIN[ADMIN LOGIN]
    LOGIN --> AUTH{Valid?}
    
    AUTH -->|No| LOGIN
    AUTH -->|Yes| DASH[ADMIN DASHBOARD]
    
    DASH --> MOD{Select Module}
    
    MOD -->|Buildings| M_BLD[Building Management]
    MOD -->|Paths| M_PTH[Outdoor Path Drawing]
    MOD -->|Indoor| M_IND[Floor Plans & Nodes]
    MOD -->|Staff| M_STF[Staff Directory Data]
    MOD -->|Events| M_EVT[Event Announcements]
    MOD -->|Analytics| M_ANA[Usage Statistics]
    
    M_BLD --> SAVE[Save Changes]
    M_PTH --> SAVE
    M_IND --> SAVE
    M_STF --> SAVE
    M_EVT --> SAVE
    
    SAVE --> DASH
    DASH --> EXIT[Logout]
    EXIT --> FINISH([FINISH])

    class START,FINISH startEnd
    class LOGIN,DASH,M_BLD,M_PTH,M_IND,M_STF,M_EVT,M_ANA display
    class AUTH,MOD decision
```
