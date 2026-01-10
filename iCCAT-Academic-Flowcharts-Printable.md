# iCCAT Academic Flowcharts - Printable Edition
## Interactive Campus Companion & Assistance Terminal

This document contains simplified, academic-style flowcharts for the iCCAT kiosk system. Each diagram follows a linear progression with minimal decision points for maximum clarity.

---

## User Perspective Flowcharts

### User Flow 1: Main Session Overview
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef connector fill:#8b5cf6,stroke:#7c3aed,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    START([START]) --> HOME[/HOME PAGE/]
    HOME --> MENU[SELECT FEATURE]
    MENU -->|Navigation| CONN_A((A))
    MENU -->|Events| CONN_B((B))
    MENU -->|Staff| CONN_C((C))
    MENU -->|About| CONN_D((D))
    MENU -->|Feedback| CONN_E((E))
    
    CONN_A --> END([END])
    CONN_B --> END
    CONN_C --> END
    CONN_D --> END
    CONN_E --> END

    class START,END startEnd
    class CONN_A,CONN_B,CONN_C,CONN_D,CONN_E connector
    class HOME,MENU display
```

### User Flow 2: Section A - Campus Navigation
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    A((A)) --> NAV[NAVIGATION PAGE]
    NAV --> SEARCH[SEARCH BUILDING]
    SEARCH --> VIEW[VIEW ON MAP]
    VIEW --> DIR[GET DIRECTIONS]
    DIR --> ROUTE[DISPLAY ROUTE]
    ROUTE --> FINISH([FINISH])

    class FINISH startEnd
    class NAV,VIEW,ROUTE display
```

### User Flow 3: Section B - Events & Announcements
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    B((B)) --> EVENTS[EVENTS PAGE]
    EVENTS --> SELECT[SELECT EVENT]
    SELECT --> DETAILS[VIEW DETAILS]
    DETAILS --> FINISH([FINISH])

    class FINISH startEnd
    class EVENTS,DETAILS display
```

### User Flow 4: Section C - Staff Directory
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    C((C)) --> STAFF[STAFF DIRECTORY]
    STAFF --> SEARCH[SEARCH STAFF]
    SEARCH --> PROFILE[VIEW PROFILE]
    PROFILE --> FINISH([FINISH])

    class FINISH startEnd
    class STAFF,PROFILE display
```

### User Flow 5: Section D - About Page
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    D((D)) --> ABOUT[ABOUT PAGE]
    ABOUT --> FEATURES[VIEW FEATURES]
    FEATURES --> FINISH([FINISH])

    class FINISH startEnd
    class ABOUT,FEATURES display
```

### User Flow 6: Section E - Feedback
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 40, 'rankSpacing': 40}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    E((E)) --> FEEDBACK[FEEDBACK PAGE]
    FEEDBACK --> RATE[RATE CATEGORIES]
    RATE --> SUBMIT[SUBMIT FORM]
    SUBMIT --> THANK_YOU[THANK YOU PAGE]
    THANK_YOU --> FINISH([FINISH])

    class FINISH startEnd
    class FEEDBACK,THANK_YOU display
```

---

## Admin Perspective Flowcharts

### Admin Flow 1: Login & Dashboard
```mermaid
%%{init: {'flowchart': {'curve': 'linear', 'nodeSpacing': 50, 'rankSpacing': 50}}}%%
flowchart TB
    classDef startEnd fill:#22c55e,stroke:#16a34a,color:#fff,stroke-width:2px
    classDef display fill:#06b6d4,stroke:#0891b2,color:#fff
    
    START([START]) --> LOGIN[LOGIN PAGE]
    LOGIN --> AUTH[AUTHENTICATE]
    AUTH --> DASH[ADMIN DASHBOARD]
    DASH --> SELECT[SELECT MODULE]
    SELECT --> FINISH([FINISH])

    class START,FINISH startEnd
    class LOGIN,DASH display
```
