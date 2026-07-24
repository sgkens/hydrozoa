@{

    RootModule             = "auspex.psm1"
    ModuleVersion          = '0.5.0'
    GUID                   = '019a5fd1-507f-7ac9-afb2-68e6f3f7bb89' # TODO: Generate a new GUID
    Author                 = 'Garvey k. Snow'
    CompanyName            = 'phellams'
    Copyright              = '2025 Garvey k. Snow. All rights reserved.'
    Description            = 'A unified tool for performing CUD (Create, Update, Delete) and **array manipulation (push/pull) on various PowerShell data structures, including Hashtables, PSObjects, and PSCustomObjects.'
    PowerShellVersion      = '7.0'
    FunctionsToExport      = @(
        'Invoke-AusPex',
        'Convert-AxData',
        'Resolve-AuspexPath',
        'New-AxPsco',
        'New-AxPso',
        'New-AxHt',
        'New-Axdic',
        'New-Axsl'
    )
    AliasesToExport        = @(
        'auspex',
        'ax',
        'axdata',
        'axpath',
        'axpsco',
        'axpso',
        'axht',
        'axdic',
        'axsl'
    )
    PrivateData            = @{
        PSData = @{
            Tags                       = @('PSModule', 'module', 'powershell', 'powershellcore', 'automation', 'data-structures', 'hashtable', 'psobject', 'pscustomobject', 'array', 'array-manipulation',  'tool', 'utility', 'utility-module')
            LicenseUrl                 = 'https://choosealicense.com/licenses/mit'
            ProjectUrl                 = 'https://gitlab.com/phellams/auspex'
            IconUrl                    = 'https://raw.githubusercontent.com/phellams/phellams-general-resources/main/logos/auspex/dist/png/phellams-logo-512x512.png'
            ReleaseNotes               = @()
            Prerelease                 = 'preview.2+build4'
            RequireLicenseAcceptance   = $false
            ExternalModuleDependencies = @()
            # CHOCOLATE ---------------------
            ChocoTitle                 = 'Auspex - A unified tool for performing CUD (Create, Update, Delete) and array manipulation (push/pull) on various PowerShell data structures.'
            LicenseUri                 = 'https://choosealicense.com/licenses/mit'
            ProjectUri                 = 'https://gitlab.com/phellams/auspex.git'
            IconUri                    = 'https://raw.githubusercontent.com/phellams/phellams-general-resources/main/logos/auspex/dist/png/phellams-logo-512x512.png'
            Docsurl                    = 'https://pages.gitlab.io/phellams/miniforge'
            MailingListUrl             = 'https://gitlab.com/phellams/auspex/issues'
            projectSourceUrl           = 'https://gitlab.com/phellams/auspex'
            bugTrackerUrl              = 'https://gitlab.com/phellams/auspex/issues'
            Summary                    = 'A unified tool for performing CUD (Create, Update, Delete) and **array manipulation** (push/pull) on various PowerShell data structures.'
            ChocoDescription           = @"
The auspex module provides the Invoke-Auspex function (aliases: auspex, ax), a robust engine for performing Deep CRUD (Create, Read, Update, Delete) and Array Manipulation (Push/Pull) on complex PowerShell data structures.

## Features

* **Deep Path Traversal**: seamless dot-notation access (`Obj.Prop.Nested`) across mixed object types.
* **Smart Array Indexing**:
* **Direct Index**: Access specific items by position (e.g., `Users[0]`).
* **Muli-Path Index**: Access specific items by multi-path position (e.g., `Users[0].Network[Type=WAN].IP`)
* **Multi-Property Matching**: Target array items by multiple property values (e.g., `Users[ID=105&Status=Active]`)
* **Unified CRUD Operations**:
* **Create**: Safely adds properties or dictionary keys only if they don't exist.
* **Read**: Retrieves values from deep within nested structures.
* **Update**: Modifies values regardless of whether the parent is a `Hashtable`, `PSObject`, or `List`.
* **Delete**: Removes properties, keys, or array items uniformly.
* **Array Manipulation**:
* **Push**: Appends values to arrays or generic lists.
* **Pull**: Removes specific values from arrays (filtering).
* **Type Conversion**: Converts data to the desired output format: `Convert-AxData -Type 'OrderedDictionary'`
* **Type Accelerators**: `New-AxPsco @{}`, `New-AxPso @{}`, `New-AxHt @{}`, `New-AxDict @{}`, `New-AxList @{}`
* **Object Grapher**: Visualizes objects and their properties in a tree-like structure**
* **Auto-Type Detection**: Automatically detects if the target container is a Dictionary, Object, or List and applies the correct .NET method (`.Add()`, `.Remove()`, assignment, etc.).
* **Debug Logging**: detailed, color-coded execution traces (Info, Warning, Error) via `$global:__logging`.
"@
        }
        # CHOCOLATE ---------------------
    }
    HelpInfoURI            = 'https://gitlab.com/phellams/auspex/blob/main/README.md'
    DefaultCommandPrefix   = ''
}

