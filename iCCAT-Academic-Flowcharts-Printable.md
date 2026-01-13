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

---

## Kiosk System Flowcharts

### System Flow 1: Kiosk Hardware & Software Startup
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    classDef hardware fill:#64748b,stroke:#475569,color:#fff
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    
    START([START: POWER ON]) --> POWER[POWER ON KIOSK HARDWARE]
    POWER --> HW_INIT{Hardware Init Success?}
    
    HW_INIT -->|Yes| BOOT[BOOT MINI PC & WINDOWS OS]
    HW_INIT -->|No| FIX_HW[TROUBLESHOOT HARDWARE]
    
    FIX_HW --> POWER
    
    BOOT --> DISP_CHK{Are Displays Connected?}
    DISP_CHK -->|Yes| WIN_READY[WINDOWS OS READY]
    DISP_CHK -->|No| FIX_DISP[RECONNECT DISPLAY CABLES]
    
    FIX_DISP --> DISP_CHK
    
    WIN_READY --> AUTO_LOG[AUTO-LOGIN TO WINDOWS]
    AUTO_LOG --> BROWSER[LAUNCH BROWSER IN KIOSK MODE]
    
    BROWSER --> LOAD_APP[LOAD iCCAT WEBAPP URL]
    LOAD_APP --> APP_INIT{Webapp Load Success?}
    
    APP_INIT -->|Yes| FIREBASE[CONNECT TO FIREBASE LISTENERS]
    APP_INIT -->|No| CONN_C((C))
    
    FIREBASE --> READY[/KIOSK READY: HOME PAGE/]
    READY --> CONN_A((A))

    class START startEnd
    class READY display
    class POWER,BOOT,WIN_READY,AUTO_LOG,BROWSER,LOAD_APP,FIREBASE action
    class HW_INIT,DISP_CHK,APP_INIT decision
    class CONN_A,CONN_C connector
```

### System Flow 2: Operational Loop
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    
    CONN_A((A)) --> TIME_CHK{Is Closing Hour?}
    TIME_CHK -->|Yes| CONN_B((B))
    TIME_CHK -->|No| IDLE_CHK{Is Inactivity Timeout?}
    
    IDLE_CHK -->|Yes| SCR[/SCREENSAVER MODE/]
    IDLE_CHK -->|No| ACTIVE[ACTIVE USER SESSION]
    
    SCR --> WAKE{Screen Touched?}
    WAKE -->|Yes| HOME[/HOME PAGE/]
    WAKE -->|No| SCR
    
    HOME --> ACTIVE
    ACTIVE --> SYNC_CHK{Is Online?}
    
    SYNC_CHK -->|Yes| PUSH[PUSH ANALYTICS TO FIREBASE]
    SYNC_CHK -->|No| QUEUE[QUEUE ANALYTICS LOCALLY]
    
    PUSH --> CONN_A
    QUEUE --> CONN_A

    class HOME,SCR display
    class ACTIVE,PUSH,QUEUE action
    class TIME_CHK,IDLE_CHK,WAKE,SYNC_CHK decision
    class CONN_A,CONN_B connector
```

### System Flow 3: Closing Procedures
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    
    CONN_B((B)) --> SH_TYPE{Is Scheduled Shutdown?}
    
    SH_TYPE -->|Yes| SCHED[WINDOWS TASK TRIGGER]
    SH_TYPE -->|No| ADMIN[ADMIN INITIATES SHUTDOWN]
    
    SCHED --> END_DATA[SEND FINAL UPTIME DATA]
    ADMIN --> END_DATA
    
    END_DATA --> CLOSE_APP[CLOSE BROWSER WEBAPP]
    CLOSE_APP --> WIN_SHUT[WINDOWS OS SHUTDOWN]
    WIN_SHUT --> FINISH([END: POWER OFF])

    class FINISH startEnd
    class SCHED,ADMIN,END_DATA,CLOSE_APP,WIN_SHUT action
    class SH_TYPE decision
    class CONN_B connector
```

### System Flow 4: Error Handling
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px,rx:20,ry:20
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    
    CONN_C((C)) --> ERR_TYPE{Is Network Error?}
    
    ERR_TYPE -->|Yes| OFFLINE[LOAD FROM OFFLINE CACHE]
    ERR_TYPE -->|No| CRASH[APP CRASH RECOVERY]
    
    OFFLINE --> CONN_A((A))
    
    CRASH --> RESTART[AUTO-RESTART BROWSER]
    RESTART --> RELOAD[RELOAD WEBAPP URL]
    RELOAD --> CONN_A

    class OFFLINE,RESTART,RELOAD action
    class ERR_TYPE decision
    class CONN_A,CONN_C connector
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

### Admin Flow 2: Module Management Details
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef action fill:#00b4d8,stroke:#0077b6,color:#fff
    classDef decision fill:#f59e0b,stroke:#d97706,color:#fff
    
    MA((M_A)) --> BLD_ACT{Add Building?}
    BLD_ACT -->|Yes| B_ADD[CREATE NEW BUILDING]
    BLD_ACT -->|No| B_EDT[EDIT EXISTING BUILDING]
    B_ADD --> B_SAVE[SAVE TO FIREBASE]
    B_EDT --> B_SAVE
    
    MB((M_B)) --> PTH_ACT{Add New Path?}
    PTH_ACT -->|Yes| P_ADD[DRAW NEW PATH]
    PTH_ACT -->|No| P_EDT[MODIFY EXISTING PATH]
    P_ADD --> P_SAVE[SAVE TO FIREBASE]
    P_EDT --> P_SAVE
    
    MC((M_C)) --> FLR_ACT{Upload Plan?}
    FLR_ACT -->|Yes| F_UPL[UPLOAD FLOOR PLAN]
    FLR_ACT -->|No| F_NOD[MANAGE INDOOR NODES]
    F_UPL --> F_SAVE[SAVE TO FIREBASE]
    F_NOD --> F_SAVE
    
    MD((M_D)) --> STF_ACT{Add Staff?}
    STF_ACT -->|Yes| S_ADD[REGISTER NEW STAFF]
    STF_ACT -->|No| S_EDT[UPDATE STAFF PROFILE]
    S_ADD --> S_SAVE[SAVE TO FIREBASE]
    S_EDT --> S_SAVE
    
    ME((M_E)) --> EVT_ACT{Post Event?}
    EVT_ACT -->|Yes| E_ADD[POST NEW ANNOUNCEMENT]
    EVT_ACT -->|No| E_EDT[UPDATE EVENT DETAILS]
    E_ADD --> E_SAVE[SAVE TO FIREBASE]
    E_EDT --> E_SAVE
    
    MF((M_F)) --> ANA_ACT{Export Data?}
    ANA_ACT -->|Yes| A_EXP[EXPORT CSV/JSON]
    ANA_ACT -->|No| A_VEW[VIEW DASHBOARD CHARTS]
    A_EXP --> A_RET[RETURN TO DASHBOARD]
    A_VEW --> A_RET
```
