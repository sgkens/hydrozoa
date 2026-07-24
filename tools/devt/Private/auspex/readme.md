<div align="center">
    <h1>
        <img src="https://raw.githubusercontent.com/phellams/phellams-general-resources/main/logos/auspex/dist/png/auspex-128x128.png" alt="PWSL Logo">
        <br>
        <strong>Auspex</strong>
    </h1>
    <p><b>Deep CRUD and Array Manipulation Engine</b></p>
    <p>The <b>auspex</b> module provides the <code>Invoke-Auspex</code> function (aliases: <code>auspex</code>, <code>ax</code>), a robust engine for performing <b>Deep CRUD</b> (Create, Read, Update, Delete) and <b>Array Manipulation</b> (Push/Pull) on complex PowerShell data structures.</p>
    <p>Unlike standard assignment, <code>Auspex</code> abstracts the underlying differences between <b>Hashtables</b>, <b>PSObjects</b>, <b>Dictionaries</b>, and <b>Lists</b>. It features a powerful <b>Path Resolution Engine</b> that allows you to traverse nested objects, index into arrays, and even <b>select array items by value</b> using a unified syntax (e.g., <code>Servers[0].Network[Type='WAN'].IP</code>).</p>
    <small>Available on <strong>MacOS</strong>, <strong>Linux</strong>, and <strong>Windows</strong></small>
    <p>🚨 <strong>Requirement:</strong> powershell 7.x</p>
    <span>
        <a href="https://gitlab.com/phellams/auspex#examples">🧷 <strong>Examples</strong></a>
        <a href="https://gitlab.com/phellams/auspex#cmdlet-reference">🧷 <strong>Cmdlet Reference</strong></a>
        <a href="https://gitlab.com/phellams/auspex#data-accelerators">🧷 <strong>Data Accelerators</strong></a>
        <a href="https://www.powershellgallery.com/packages/auspex">🧷 <strong>PSGallery</strong></a>
        <a href="https://chocolatey.org/packages/auspex">🧷 <strong>Chocolatey</strong></a>
        <a href="https://github.com/phellams/auspex">🧷 <strong>GitHub</strong></a>
    </span>
    <br>
    <br>
    <img src="https://raw.githubusercontent.com/phellams/phellams-general-resources/main/misc/hr/hr-style-solution.svg" alt="hr-style-solution" >
    <br>
    <br>
</div>

[![gitlab-license](https://img.shields.io/gitlab/license/phellams/auspex?style=flat-square&logo=gitlab&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)](https://gitlab.com/phellams) [![gitlab-pipeline](https://img.shields.io/gitlab/pipeline-status/phellams/auspex?style=flat-square&logo=gitlab&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)](https://gitlab.com/phellams) [![gitlab-issues](https://img.shields.io/gitlab/issues/open/phellams/auspex?style=flat-square&logo=gitlab&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)](https://gitlab.com/phellams) [![powershell-version](https://img.shields.io/powershellgallery/v/@phellams/auspex?style=flat-square&logo=powershell&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)](https://www.powershellgallery.com/packages/auspex) [![choco-version](https://img.shields.io/chocolatey/v/@phellams/auspex?style=flat-square&logo=chocolatey&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)](https://community.chocolatey.org/packages/auspex) [![codecov-coverage](https://img.shields.io/codecov/c/github/phellams/auspex?style=flat-square&logo=codecov&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)](https://img.shields.io/codecov/c/github/phellams/auspex?style=flat-square&logo=codecov&labelColor=%23af5f00&color=%23ffd7af&logoColor=%23ffd700)

<a id="top"></a>

<details>
<summary><b>📚 Table of Contents</b></summary>

  - [Features](#features)
- [**Installation**](#installation)
  - [Additinonal Installation Options:](#additinonal-installation-options)
    - [📦 GitLab Packages](#-gitlab-packages)
    - [🧺 Generic Asset](#-generic-asset)
    - [💾 Git Clone](#-git-clone)
- [**Quick Start**](#quick-start)
- [**Cmdlet Reference**](#cmdlet-reference)
  - [Invoke-Auspex](#invoke-auspex)
    - [Parameters](#parameters)
- [**Logging Control**](#logging-control)
- [**Examples**](#examples)
  - [*Setup*](#setup)
  - [*CRUD Operations*](#crud-operations)
    - [*🟢 Reading (Deep Access & Querying)*](#-reading-deep-access-querying)
    - [*🔵 Updating (Modify Existing)*](#-updating-modify-existing)
    - [*🟣 Creating (Building New Properties)*](#-creating-building-new-properties)
    - [*🟡 Pushing (Array Appending)*](#-pushing-array-appending)
    - [*🔴 Pulling & Deleting*](#-pulling-deleting)
- [**Path Syntax Guide**](#path-syntax-guide)
- [**Data Accelerators**](#data-accelerators)
- [**Supported Data Types Comparison**](#supported-data-types-comparison)
- [**Pipeline Support**](#pipeline-support)
  - [**Disable Logging for Production**](#disable-logging-for-production)
- [**Troubleshooting**](#troubleshooting)
  - [*Property Already Exists Error*](#property-already-exists-error)
  - [*Property Not Found Error*](#property-not-found-error)
  - [*Push/Pull Only Works on Arrays*](#pushpull-only-works-on-arrays)
- [**Contributing**](#contributing)
- [📑 License](#-license)

</details>

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

---


## **Installation**

Phellams modules are available from [**PowerShell Gallery**](https://www.powershellgallery.com/packages/auspex) and [**Chocolatey**](https://chocolatey.org/packages/auspex). you can access the raw assets via [**Gitlab Generic Assets**](https://gitlab.com/phellams/auspex/-/packages?orderBy=name&sort=desc&search[]=auspex) or nuget repository via [**Gitlab Packages**](https://gitlab.com/phellams/auspex/-/packages/?orderBy=name&sort=desc&search[]=auspex&type=NuGet).

|▓▓▓▓▒▒▒▒░░░|▓▓▓▓▒▒▒▒░░░|▓▓▓▓▒▒▒▒░░░|
|-|-|-|
|📦 PSGallery | <a href="https://www.powershellgallery.com/packages/auspex"> <img src="https://img.shields.io/powershellgallery/v/auspex?label=version&style=flat-square&logoColor=blue&labelColor=23CD5C5C&color=%231E3D59" alt="powershellgallery"></a> | <img src="https://img.shields.io/powershellgallery/dt/auspex?style=flat-square&logoColor=blue&label=downloads&labelColor=23CD5C5C&color=%231E3D59" alt="powershellgallery-downloads"> |
|📦 Chocolatey | <a href="https://community.chocolatey.org/packages/auspex/"><img src="https://img.shields.io/chocolatey/v/auspex?label=version&include_prereleases&style=flat-square&logoColor=blue&labelColor=23CD5C5C&color=%231E3D59" alt="chocolatey"/></a> | <img src="https://img.shields.io/chocolatey/dt/auspex?style=flat-square&logoColor=blue&label=downloads&include_prereleases&labelColor=23CD5C5C&color=%231E3D59" alt="chocolatey-downloads"> |

### Additinonal Installation Options:
 
|▓▓▓▓▒▒▒▒░░░|▓▓▓▓▒▒▒▒░░░|▓▓▓▓▒▒▒▒░░░|
|-|-|-|
|💼 Releases/Tags | <a href="https://gitlab.com/phellams/auspex/-/releases"> <img src="https://img.shields.io/gitlab/v/release/phellams%2Fauspex?include_prereleases&style=flat-square&logoColor=%2300B2A9&labelColor=%23CD5C5C&color=%231E3D59" alt="gitlab-release"></a> | <a href="https://gitlab.com/phellams/auspex/-/tags"> <img src="https://img.shields.io/gitlab/v/tag/phellams%2Fauspex?include_prereleases&style=flat-square&logoColor=%&labelColor=%23CD5C5C&color=%231E3D59" alt="gitlab tags"></a> |

#### 📦 GitLab Packages

Using `nuget`: See the [**packages**](https://gitlab.com/phellams/auspex/-/packages?orderBy=name&sort=asc&search[]=auspex&type=NuGet) page for installation instructions.

> For instructions on adding `nuget` **sources** packages from *GitLab* see [**Releases**](https://github.com/sgkens/auspex/releases) artifacts or via the [**Packages**](https://gitlab.com/phellams/auspex/-/packages?orderBy=name&sort=asc&search[]=auspex&type=NuGet) page.

#### 🧺 Generic Asset

The latest release artifacts can be downloaded from the [**Generic Assets Artifacts**](https://gitlab.com/phellams/auspex/-/packages?orderBy=type&sort=desc&type=Generic) page.

#### 💾 Git Clone

```bash
# Clone the repository
git clone https://gitlab.com/phellams/auspex.git
cd auspex
import-module .\
```

---

## **Quick Start**

Module is self contained with-in a single `.psm1` file and can be imported with `Import-Module .\auspex.psd1` or `using module .\auspex.psm1` if your using **Auspex** with another module i would suggest just copying the `auspex.psm1` to your module folder and use `using module path\to\auspex.psm1` or install **Auspex** from one of the methods above.

```powershell
# Import the module
# Requires Find-Module -name auspex | install-module
Import-Module -Name Auspex

# Using with another module
# Copy the file to you module folder
using module .\auspex.psm1

# Create a data object
$data = [PSCustomObject]@{ NetworkName = 'Lan-room-1' }
# or use auspex
$data = axpsco @{ NetworkName = 'Lan-room-1' }

# Create a new property
auspex $data create 'Status' 'Active'

# Read the property
auspex $data read 'Status'

# Update the property
auspex $data update 'Status' 'In-Active'

# Delete the property
auspex $data delete 'Status'

```

<div align="right" ><a href="#top" ><small><code>⁛</code> Back to top</small></a></div>

---

## **Cmdlet Reference**

### Invoke-Auspex

This is the main function exposed by the module. It allows you to perform CRUD operations on **Hashtables**, **PSObjects**, **Dictionaries**, and **Lists**, push and pull actions for **objects** and **arrays**.

<small>**Aliases**: <code>ax</code> <code>auspex</code> </small>

**Syntax**

```pre
Invoke-Auspex [-o|ObjectPointer (Object)]
              [-a|Action (String(validateset(read,create,update,delete,push,pull))] 
              [-k|KeyName (String)]
              [-va|Value (Any)]
              [-l|Log (Switch)]
              [-e|EmbeddedName (String)]
```

**Parameters**

| Name       | Type                                  | Description                                                          | Required |
| :--------- | :------------------------------------ | :------------------------------------------------------------------- | :------- |
| **ObjectPointer**   | *PSObject*, *PSCustomObject*, *Hashtable*, *Dictionary*, *SortedList* | The target data structure to modify. | Yes |
| **Action** | *String* | The operation to perform: `create`, `read`, `update`, `delete`, `push`, `pull` | Yes |
| **Name**   | *String* | The property or key name to target. | Yes |
| **Value**  | *Any* | The value to set (for create/update/push) or remove (for pull). Not required for read/delete. | No |
| **log**  | *switch* | Enable logging | No |
| **EmbeddedName**  | *string* | pre-apend a custom name to the log message | No |

> ✴️ ***Note*** !
> ═══════
> These parameters are positionally numbered so you can pass theme in without the **ParameterName** in order.
> eg: 
> `auspex $data create 'Status' 'Active'`
> or: 
> `ax $data create 'Status' 'Active'`
> or: 
> `Invoke-Auspex $data create 'Status' 'Active'`

> ✴️ ***Note*** !
> ═══════
> You can also work with the objects in reverse instead of using the `-KeyName` parameter with dot or array notation or both, you can simply source the object yourself and pass it in as the `-ObjectPointer` parameter. eg: `Invoke-Auspex $data.Network create 'Status' 'Active'`

#### **Examples**

##### *CRUD Operations*

*🟢 Reading (Deep Access & Querying)*

```powershell
# 1. Simple Nested Read
auspex -Obj $Config -Action "read" -Name "System.Hostname"
# or shorthand
auspex -Obj $Config -Action "read" -Name "System.Hostname"

# 2. Array Indexing (Reading the 2nd DNS server)
auspex -Obj $Config -Action "read" -Name "Network.DNS[1]"

# 3. COMPLEX: Query Match (Find the IP of the interface named 'eth1')
# Logic: Go to Network -> Go to Interfaces -> Find Item where Name='eth1' -> Get IP
auspex -Obj $Config -Action "read" -Name "Network.Interfaces[Name='eth1'].IP"

```

*🔵 Updating (Modify Existing)*

Modify values deep inside the structure using the same path logic.

```powershell
# 1. Update a HashTable value via Index
auspex -Obj $Config -Action "update" -Name "Network.DNS[0]"  -Value "9.9.9.9"

# 2. Update a Property found via Query Match
# We are enabling eth1
auspex -Obj $Config -Action "update" -Name "Network.Interfaces[Name='eth1'].Active" -Value $true

# Verify Update
$Config.Network.Interfaces[1]

```

*🟣 Creating (Building New Properties)*

This uses the logic to add keys to Hashtables or NoteProperties to PSObjects.

```powershell
# 1. Add a new property to the System PSObject
auspex -Obj $Config -Action "create" -Name  "System.Kernel" -Value "5.15-generic"

# 2. Add a new Key to the Network Hashtable
auspex -Obj $Config -Action "create" -Name "Network.Gateway" -Value "192.168.1.1"

# Verify
$Config.System
$Config.Network.Gateway

```

##### *Extend CRUD-PP Operations*

*🟡 Pushing (Array Appending)*

This adds items to arrays or generic lists.

```powershell
Write-Host "`n--- PUSH EXAMPLES ---" -ForegroundColor Magenta

# 1. Push to a Generic List<string> (Tags)
auspex -Obj $Config -Name "Tags" -Action "push" -Value "HighPriority"

# 2. Push a new Object to an Array of Hashtables
$NewInterface = @{ Name = "docker0"; IP = "172.17.0.1"; Active = $true }
auspex -Obj $Config -Name "Network.Interfaces" -Action "push" -Value $NewInterface

# Verify
$Config.Tags
Write-Host "Interface Count: $($Config.Network.Interfaces.Count)"

```
*🔴 Pulling & Deleting*

Removing items from arrays (Pull) or removing properties/keys entirely (Delete).

```powershell
Write-Host "`n--- DELETE/PULL EXAMPLES ---" -ForegroundColor Magenta

# 1. PULL: Remove "Web" from Tags list
auspex -Obj $Config -Name "Tags" -Action "pull" -Value "Web"

# 2. DELETE: Remove the 'OS' property from System
auspex -Obj $Config -Name "System.OS" -Action "delete"

# 3. DELETE (Advanced): Remove a specific interface by Index
# Note: Since Interfaces is a fixed array @(), this might fail in standard PS arrays
# unless the logic re-creates the array (which we did not implement for Delete, only Pull).
# However, let's delete the 'Gateway' key we added to the Hashtable earlier.
auspex -Obj $Config -Name "Network.Gateway" -Action "delete"

# Verify
$Config.Tags
$Config.System

```

##### Graph Operations

*🟣 Output Graph top level object*

```powershell
auspex -Obj $Config -Grapher
```

*🟣 Output Graph from nested object*

```powershell
auspex -Obj $Config -Name "Network.Interfaces" -Grapher
```

### Convert-AxData

This function supports converting from any dictionary or object type to any of the six specific output formats you requested and automatically detects and normalizes data from:

 - `[Hashtable]`
 - `[OrderedDictionary]` - Ordered hashtable are **SortedDictionaries**
 - `[PSCustomObject]`
 - `[PSObject]`
 - `[System.Collections.Generic.Dictionary]`
 - `[System.Collections.SortedList]`

**Supported Data Types**

| Types | Output .NET Type | Best Used For |
| --- | --- | --- |
| **hashtable** | `[System.Collections.Hashtable]` | Legacy compatibility, unsorted high-speed lookups. |
| **Hashtable-Ordered** | `System.Collections.Specialized.OrderedDictionary` | Preserving key order (JSON generation, readable configs). |
| **PSObject** | `PSCustomObject` | Standard PowerShell pipeline usage, display formatting. |
| **PSCustomObject** | `PSCustomObject` | (Alias for `PSObject`). |
| **SortedList** | `System.Collections.SortedList` | Automatically sorting keys alphabetically (A-Z). |
| **Dictionary** | `System.Collections.Generic.Dictionary[string,object]` | Strictly typed keys, high performance in C# interop. |

#### Usage Examples

**Convert a Hashtable to a Ordered Hashtable**

```powershell
$hash = @{ c=3; a=1; b=2 }
$ordered = $hash | Convert-AxData -Type 'Hashtable-Ordered'
# Output will be automatically sorted: a=1, b=2, c=3

```

**Convert a Hashtable to a SortedList:**

```powershell
$hash = @{ c=3; a=1; b=2 }
$sorted = $hash | Convert-AxData -Type 'SortedList'
# Output will be automatically sorted: a=1, b=2, c=3

```

**Convert a PSObject to a standard Dictionary:**

```powershell
$obj = [PSCustomObject]@{ ID=1; Name="Admin" }
$dict = $obj | Convert-AxData -Type 'Dictionary'
# Result is a Dictionary[string,object]

```

#### Parameters



### Resolve-AuspexPath

### New-AxPsco

### New-AxPso

### New-AxHt

### New-AxDict

### New-AxList


<div align="right" ><a href="#top" ><small>⁛ Back to top</small></a></div>

---


## **Logging Control**

**Enable logging globally:**

```powershell
$global:__logging = $true
```

**Disable logging globally:**

```powershell
$global:__logging = $false
```

**Enable logging via param**

```powershell
auspex -Obj $data -Action create -Name 'Status' -Value 'Active' -log
```

## **Examples**

> Note!: 
`auspex` or `ax` or `Invoke-Auspex` you can ommit the `-ObjectPointer`, `-Name`, `-Action` and `-Value` parameters, these parameters are positionally numbered so you can pass theme in without the `-ParameterName` in order.

### *Setup*

Run this block first to initialize the environment and the test data.

<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

```powershell
# --- Test Data Construction ---
# We are mixing Hashtables, PSObjects, and Arrays to test robustness
$Config = [PSCustomObject]@{
    System = [PSCustomObject]@{
        Hostname = "SKG-Blade-01"
        OS       = "Ubuntu 22.04"
    }
    Network = @{ # Hashtable
        Interfaces = @(
            @{ Name = "eth0"; IP = "192.168.1.10"; Active = $true }
            @{ Name = "eth1"; IP = "10.0.0.5";     Active = $false }
        )
        DNS = @("8.8.8.8", "1.1.1.1")
    }
    Tags = [System.Collections.Generic.List[string]]::new() # Generic List
}

$Config.Tags.Add("Production")
$Config.Tags.Add("Web")

```


<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

## **Path Syntax Guide**

`Auspex` uses a special string syntax to locate items deep inside your objects.

| Syntax | Description | Example |
| --- | --- | --- |
| **Dot Notation** | Access a property or key by name. | `System.Network.IP` |
| **Index Notation** | Access an array or list item by its integer index. | `Servers[0]` |
| **Query Match** | Find an item in an array where a property equals a specific value. | `Users[Name='Admin']` |
| **Combined** | Chain any of the above to reach deep values. | `Datacenter.Racks[0].Servers[ID='Web01'].State` |

**Example of Query Match:**
If you have a list of users and want to update the role for "Alice":

```powershell
# Instead of looping through the array...
ax -Obj $Data -Name "Users[Name='Alice'].Role" -Action Update -Value "Manager"

```
<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

## **Data Accelerators**

**New-Axpso**

**Alias**: `axpso`

Generates a `PSObject` from `hashtable`.

```powershell
$pso = iminipso @{ prop1 = 'prop1value'; level = 1 }
```

**New-Axpsco**

**Alias**: axpsco

Generates a `PSCustomObject` from `hashtable`.

```powershell
$psco = axpsco @{ prop1 = 'prop1value'; level = 1 }
```

**New-Axht**

**Alias**: axht

Generates a `Hashtable` from `hashtable`.

```powershell
$psht = axht @{ prop1 = 'prop1value'; level = 1 }
```

**New-Axdic**

**Alias**: axdic

Generates a `System.Collections.Generic.Dictionary[string, object]` from `Hashtable`.

```powershell
$psdic = axdic @{ prop1 = 'prop1value'; level = 1 }
```

**New-axsl**

**Alias**: axsl

Generates a `System.Collections.SortedList` from `Hashtable`.

```powershell
$psdsl = axsl @{ prop1 = 'prop1value'; level = 1 }
```

<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

## **Supported Data Types Comparison**

| Data Type | Create | Read | Update | Delete | Push/Pull Arrays | Nested Objects |
|:----------|:------:|:----:|:------:|:------:|:----------------:|:----: |
| **Hashtable** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PSObject** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PSCustomObject** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dictionary** | ✅ | ✅ | ✅ | ✅ | ✅ |✅ |
| **SortedList** | ✅ | ✅ | ✅ | ✅ | ✅ |✅ |

**Array Support**: `[string[]]`, `[object[]]`, `[int[]]`, `[hashtable[]]`, `[psobject[]]`, `[pscustomobject[]]`

---

## **Pipeline Support**

```powershell
# The Data parameter accepts pipeline input
$myHashtable = @{ Status = 'Active' }
$myHashtable | Invoke-Axpso -Obj $data -Action create -Name 'Count' -Value 100
```

### **Disable Logging for Production**

```powershell
# At the start of your script
$global:__logging = $false
# All auspex calls will now run silently
```

<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

## **Troubleshooting**

### *Property Already Exists Error*

If you see a warning about a property already existing when using `create`:

```powershell
# Use update instead of create for existing properties
auspex -Obj $obj -Action update -Name 'ExistingProp' -Value 'NewValue'
```

### *Property Not Found Error*

If you see a warning about a property not found when using `update`, `read`, or `delete`:

```powershell
# Use create first to add the property
auspex -Obj $obj -Action create -Name 'NewProp' -Value 'Value'
```

### *Push/Pull Only Works on Arrays*

The `push` and `pull` actions require the property to be an array:

```powershell
# First, create an array property
auspex -Obj $obj -Action create -Name 'Items' -Value @()

# Then push values to it
auspex -Obj $obj -Action push -Name 'Items' -Value 'Item1'
```

<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

<!-- ROADMAP -->
# Roadmap

- [x] Add Support for Dictionary, SortedList
- [x] Add comprehensive Pester tests
- [x] Create module manifest (.psd1) with proper versioning
- [x] Add support for Dictionary
- [x] Optimize performance for large datasets
- [ ] Add `-WhatIf` and `-Confirm` support



## **Contributing**

Contributions are welcome! Please fork the repository and submit a **Merge Request** (MR) targeting the `develop` branch.

1. **Fork the Project**
   Click the "Fork" button in the top right corner of the repository page.

2. **Clone your Fork**
   ```bash
   git clone [https://gitlab.com/YOUR_USERNAME/pwsl.git](https://gitlab.com/YOUR_USERNAME/pwsl.git)
   cd pwslmerge_requests/new)
   ```

3. Create a Feature Branch Ensure you base your work on the develop branch:
   ```bash
   git switch develop
   git switch -c feature/AmazingFeature
   ```

4. Commit your Changes
   ```bash
   git commit -m 'feat: Add some AmazingFeature'
   ```

5. Push to the Branch
   ```bash
   git push origin feature/AmazingFeature
   ```

6. Open a Merge Request

   <a href="https://gitlab.com/phellams/pwsl/-/merge_requests/new"><img src="https://img.shields.io/badge/Open_Merge_Request-GitLab-orange?style=flat-square&logo=gitlab"></a>
   > https://gitlab.com/phellams/pwsl/-/merge_requests/new

<div  align="right" ><a href="#features" ><small>⁛ Back to top</small></a></div>

---

## 📑 License

This project is licensed under the [MIT License] - see the LICENSE file for details.
