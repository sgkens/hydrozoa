$global:__logging = $true
$global:__auspex = @{ rootpath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition }

# ---- Helper Functions ----

# ===================== Helpers ========================

function New-CtString {
    [CmdletBinding()]
    [Alias('ctstring')]
    param(
        [parameter(Mandatory, Position = 0)]
        [string]$Message
    )

    process {
        # 1. Define standard 3/4-bit color map (Standard ANSI)
        $stdColors = @{
            'black'   = '30'
            'red'     = '31'
            'green'   = '32'
            'yellow'  = '33'
            'blue'    = '34'
            'magenta' = '35'
            'cyan'    = '36'
            'white'   = '37'
            'default' = '39'
        }

        # 2. Regex Pattern
        # Matches: {ct:color:flags:message} or {ct:color:message}
        # Flags are optional (u, b, i)
        $pattern = '(?i)\{ct:(?<Color>[^:{}]+)(?::(?<Flags>[ubi](?::[ubi])*))?:(?<Message>.*?)\}'

        $finalMessage = $Message
        $ESC = [char]27

        # 3. Get all matches
        $allMatches = [regex]::Matches($finalMessage, $pattern)

        # 4. Process right-to-left to prevent index shifting
        for ($i = $allMatches.Count - 1; $i -ge 0; $i--) {
            $match = $allMatches[$i]
            
            # -- Extract Raw Values --
            $rawColor = $match.Groups['Color'].Value.ToLower()
            $content = $match.Groups['Message'].Value
            $flagsStr = $match.Groups['Flags'].Value

            # -- Build ANSI Code List --
            $codes = [System.Collections.Generic.List[string]]::new()

            # A. Handle Flags (Bold, Underline, Italic)
            if ($flagsStr -match 'b') { $codes.Add('1') } # Bold
            if ($flagsStr -match 'i') { $codes.Add('3') } # Italic
            if ($flagsStr -match 'u') { $codes.Add('4') } # Underline

            # B. Handle Color
            if ($rawColor -match '^\d+$') {
                # Logic: 256 Color Palette (ID 0-255)
                # ANSI Format: 38;5;<n>
                $codes.Add("38;5;$rawColor")
            }
            elseif ($stdColors.ContainsKey($rawColor)) {
                # Logic: Standard Named Color
                $codes.Add($stdColors[$rawColor])
            }
            else {
                # Fallback if color name is unknown (Default to white/default)
                $codes.Add('39') 
            }

            # -- Construct Replacement String --
            # Format: <ESC>[<codes>m<Content><ESC>[0m
            $ansiSequence = "$ESC[" + ($codes -join ';') + "m"
            $replacement = "$ansiSequence$content$ESC[0m"

            # -- Replace in original string --
            $finalMessage = $finalMessage.Remove($match.Index, $match.Length).Insert($match.Index, $replacement)
        }

        return $finalMessage
    }
}

function New-kvstring {
    [CmdletBinding()]
    [Alias('kvstring')]
    param(
        [parameter(Mandatory, Position = 0)]
        [string]$message
    )
    process {
        # safety check
        if ($null -eq (Get-Command "kvinc" -ErrorAction SilentlyContinue)) {
            Write-Host "ckvstring: Missing dependency: kvinc"
            return 
        }

        $pattern = '\{((?<Level>prop|property|meta|metadata|confval|inf|err|wrn|api|git|value|type|key):)?kv:(?<Key>[^=]+)=(?<Value>.*?)\}'
        $finalMessage = $Message

        # Get all matches first
        $allMatches = [regex]::Matches($finalMessage, $pattern)

        # Process matches from right to left to avoid index shifting issues
        for ($i = $allMatches.Count - 1; $i -ge 0; $i--) {
            $match = $allMatches[$i]
            $Level = $match.Groups['Level'].Value.Trim()
            $key = $match.Groups['Key'].Value
            $value = $match.Groups['Value'].Value.Trim()

            if([string]::IsNullOrEmpty($Level)) {
                $replacement = New-Kvinc -KeyName $key -KeyValue $value
            }else{
                $replacement = New-Kvinc -KeyName $key -KeyValue $value -Type $Level
            }
            
            $finalMessage = $finalMessage.Remove($match.Index, $match.Length).Insert($match.Index, $replacement)
        }

        return $finalMessage
    }
}

function New-Kvinc {
    [CmdletBinding()]
    [Alias('kvinc')]
    param(
        [parameter(Mandatory, Position = 0)]
        [string]$keyName,

        [parameter(Mandatory, Position = 1)]
        [string]$KeyValue,

        [parameter(Mandatory=$false, Position = 2)]
        [ValidateSet(
            'inf',
            'err',
            'wrn',
            'prop',
            'property',
            'api',
            'git',
            'value',
            'type',
            'key',
            'meta',
            'metadata',
            'confval',
            'none'
        )]
        [string]$type
    )
    
    [string]$string = ''
    
    if(!$type) {
        $type = 'none'
    }

    $utility = @{
        kvinc_bracket_color  = "95"
        kvinc_bracket_format = ";1"
        kvinc_type_color     = "90"
        kvinc_type_format    = ";1"
        kvinc_key_color      = "94"
        kvinc_key_format     = ";1"
        kvinc_value_color    = "90"
        kvinc_value_format   = ";1"
    }
    
    if ($type -eq 'none') {
        
        $string += "`e[$($utility.kvinc_bracket_color)$($utility.kvinc_bracket_format)m{`e[0m"
      
        $string += " `e[$($utility.kvinc_key_color)$($utility.kvinc_key_format)m$keyName`e[0m"
        $string += " `e[$($utility.kvinc_bracket_color)$($utility.kvinc_bracket_format)m:`e[0m"
        $string += " `e[$($utility.kvinc_value_color)$($utility.kvinc_value_format)m$KeyValue`e[0m"
      
        $string += "`e[$($utility.kvinc_bracket_color)$($utility.kvinc_bracket_format)m }`e[0m"
      
        return $string.replace("^\{","")
    
    }else{

        $string += "`e[$($utility.kvinc_bracket_color)$($utility.kvinc_bracket_format)m{`e[0m "

        switch ($type) {
            # NOTE: Add in more options
            'inf' { $string      += "`e[37$($utility.kvinc_type_format)mINF`e[0m ≡" }
            'wrn' { $string      += "`e[33$($utility.kvinc_type_format)mWRN`e[0m ≡" }
            'err' { $string      += "`e[31$($utility.kvinc_type_format)mERR`e[0m ≡" }
            'prop' { $string     += "`e[31$($utility.kvinc_type_format)mPROP`e[0m ≡" }
            'property' { $string += "`e[31$($utility.kvinc_type_format)mPROPERTY`e[0m ≡" }
            'api' { $string      += "`e[31$($utility.kvinc_type_format)mAPI`e[0m ≡" } 
            'git' { $string      += "`e[31$($utility.kvinc_type_format)mGIT`e[0m ≡" }
            'value' { $string    += "`e[31$($utility.kvinc_type_format)mVALUE`e[0m ≡" }
            'key' { $string      += "`e[31$($utility.kvinc_type_format)mKEY`e[0m ≡" }
            'type' { $string     += "`e[31$($utility.kvinc_type_format)mTYPE`e[0m ≡" }
            'meta' { $string     += "`e[31$($utility.kvinc_type_format)mMETA`e[0m ≡" }
            'metadata' { $string += "`e[31$($utility.kvinc_type_format)mMETADATA`e[0m ≡" }
            'confval' { $string  += "`e[31$($utility.kvinc_type_format)mCONFVAL`e[0m ≡" }
            'none' {  $string = "" }
            default {  }
        }
        $string += " `e[$($utility.kvinc_key_color)$($utility.kvinc_key_format)m$keyName`e[0m"
        $string += " `e[$($utility.kvinc_bracket_color)$($utility.kvinc_bracket_format)m:`e[0m"
        $string += " `e[$($utility.kvinc_value_color)$($utility.kvinc_value_format)m$KeyValue`e[0m"
       
        $string += " `e[$($utility.kvinc_bracket_color)$($utility.kvinc_bracket_format)m}`e[0m"

        return $string
    }
}


#! Requires kvinc, ckvstring
function Write-logr {
    [cmdletbinding()]
    [Alias('logr')]
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$Message,

        [Parameter(Mandatory = $true, Position = 1)]
        [ValidateSet( 
            'create',
            'read',
            'update',
            'delete',
            'push',
            'pull',
            'convert',
            'check',
            'config',
            'fetch',
            'request',
            'response',
            'patch',
            'build',
            'sticher',
            'compile',
            'astscan',
            'exc',
            'ast',
            'test',
            'lint',
            'format',
            'gitpull',
            'gitpush',
            'gitfetch',
            'gitclone',
            'gitmerge',
            'gitbranch',
            'success',
            'complete',
            'finished',
            'failed',
            'error',
            'warning',
            'info',
            'debug',
            'trace',
            'bootstrap'
            )]
        [string]$Action,

        [Parameter(Mandatory = $true, Position = 2)]
        [ValidateSet('err', 'inf', 'wrn', 'chk', 'api', 'git', 'exc', 'act')]
        [string]$Type,

        [Parameter(Mandatory = $false, Position = 3)]
        [string]$LogName = 'logr',

        [Parameter(Mandatory = $false)]
        [switch]$childLog,

        [Parameter(Mandatory = $false)]
        [string]$EmbeddedName
    )

    $utility = @{
        logr_logname_color  = "95"
        logr_logname_format = ";1;2;3"
        logr_type_format    = ";1"
        logr_action_format  = ";1"
        logr_message_color  = "90"
        logr_message_format = ";1"
    }

    # Run Message Through kvstring and ctstring for
    # color and formatting
    $Message = New-Kvstring $Message
    $Message = New-Ctstring $Message
    
    # Build log message with ANSI colors
    # as minifore for created to be used with other others lets set a custom $EmbeddedName 
    # which we attach to the logname for better tracing if flagged

    [string] $logMessage = ''

    if ($EmbeddedName -ne '') {
        $logMessage += "$EmbeddedName `e[$($utility.logr_logname_color)$($utility.logr_logname_format)m$LogName`e[0m"
    }else{
        $logMessage += "`e[$($utility.logr_logname_color)$($utility.logr_logname_format)m$LogName`e[0m"
    }

    
    if(!$childLog) {
        $logMessage += "`e[90;1m ⇛ `e[0m"
        # Add type prefix with color
        # Use ASCII (ANSI) color codes for type prefix
        switch ($Type) {
            'err' { $logMessage += "`e[31$($utility.logr_type_format)merr`e[0m" }      # Red
            'inf' { $logMessage += "`e[37$($utility.logr_type_format)minf`e[0m" }      # Gray/White
            'wrn' { $logMessage += "`e[33$($utility.logr_type_format)mwrn`e[0m" }      # Yellow
            'chk' { $logMessage += "`e[36$($utility.logr_type_format)mchk`e[0m" }      # Cyan
            'api' { $logMessage += "`e[90$($utility.logr_type_format)mapi`e[0m" }      # Dark Gray
            'git' { $logMessage += "`e[94$($utility.logr_type_format)mgit`e[0m" }      # Light Blue
            'exc' { $logMessage += "`e[31$($utility.logr_type_format)mexc`e[0m" }      # Red
            'act' { $logMessage += "`e[32$($utility.logr_type_format)mact`e[0m" }      # Green
            default {  }
        }
    }else {
        $logMessage += "$(" " * 6)"
    }

    # Add separator
    $logMessage += ' ┊> '
    
    # Add action with color using ASCII (ANSI) escape codes
    $logMessage += switch ($Action) {
        # --- STATUS BADGES (Background Colors) ---
        { $_ -in 'success', 'complete', 'completed', 'finished', 'done' } { 
            # Bg: Neon Green (46), Fg: Black (232) -> High Contrast Badge
            "`e[38;5;232;48;5;46m $Action `e[0m" 
        }
        { $_ -in 'failed', 'error', 'exc', 'exception', 'critical' } { 
            # Bg: Red (196), Fg: White (255) -> Alarm Badge
            "`e[38;5;255;48;5;196m $Action `e[0m" 
        }
        { $_ -in 'warning', 'wrn' } { 
            # Bg: Yellow (226), Fg: Black (232) -> Caution Badge
            "`e[38;5;232;48;5;226m $Action `e[0m" 
        }

        # --- CRUD (Foreground Colors) ---
        'create' { "`e[38;5;45mcreate`e[0m" }   # Bright Blue
        'read'   { "`e[38;5;40mread`e[0m" }     # Green
        'update' { "`e[38;5;214mupdate`e[0m" }  # Orange/Gold
        'delete' { "`e[38;5;160mdelete`e[0m" }  # Deep Red

        # --- Extended CRUD ---
        'push' { "`e[38;5;27mpush`e[0m" }       # Deep Blue
        'pull' { "`e[38;5;129mpull`e[0m" }      # Purple

        # --- Git Actions (The "Git Brand" Orange) ---
        { $_ -like 'git*' } { 
            # Fg: Git Orange (202)
            "`e[38;5;202m$Action`e[0m" 
        }

        # --- Build / Compile (Industrial Colors) ---
        { $_ -in 'build', 'sticher', 'compile' } { 
            # Fg: Industrial Yellow/Orange (172)
            "`e[38;5;172m$Action`e[0m" 
        }
        
        # --- AST / Linting (Tech Teals) ---
        { $_ -in 'astscan', 'astcheck', 'ast', 'lint', 'format', 'test' } { 
            # Fg: Cyan/Teal (51)
            "`e[38;5;51m$Action`e[0m" 
        }

        # --- API Actions (Distinct Pastels) ---
        'fetch'    { "`e[38;5;157mfetch`e[0m" }    # Pale Green
        'request'  { "`e[38;5;229mrequest`e[0m" }  # Pale Yellow
        'response' { "`e[38;5;203mresponse`e[0m" } # Pale Red
        'patch'    { "`e[38;5;213mpatch`e[0m" }    # Pink

        # --- Other Actions ---
        'convert' { "`e[38;5;242mconvert`e[0m" } # Grey
        'config'  { "`e[38;5;111mconfig`e[0m" }  # Sky Blue
        'check'   { "`e[38;5;255mcheck`e[0m" }   # Bright White
        
        # --- Logging Levels ---
        'info'    { "`e[38;5;39minfo`e[0m" }     # Dodger Blue
        'debug'   { "`e[38;5;245mdebug`e[0m" }   # Light Grey
        'trace'   { "`e[38;5;239mtrace`e[0m" }   # Dark Grey

        default {
            logr "Unknown action type '$Action' provided for logging." 'error' 'err' $LogName $EmbeddedName
            return
        }
    }
    
    $logMessage += "`e[90;1m ⇛ `e[0m"
    # Add message
    $logMessage += "`e[$($utility.logr_message_color)$($utility.logr_message_format)m$Message`e[0m"

    if ($global:__logging -or $script:__logging -or $verbose -or $log) {
        [System.Console]::WriteLine($logMessage)
    }
}

function _logr {
    param(
        [Parameter(Mandatory, Position=0)]
        [string]$Message,
        [Parameter(Mandatory, Position=1)]
        [string]$Action,
        [Parameter(Mandatory=$true, Position=2)]
        [string]$type,
        [Parameter(Mandatory, Position=3)]
        [string]$LogName,
        [Parameter(Mandatory=$false)]
        [string]$EmbeddedName
    )
    if($EmbeddedName){
        Write-logr -Message $Message -Action $Action -Type $type -LogName $LogName -EmbeddedName $EmbeddedName
    }else{
        Write-logr -Message $Message -Action $Action -Type $type -LogName $LogName
    }
}

# ===================== Helpers ========================

function New-AxPsco {
    [CmdletBinding()]
    [Alias('axpsco')]
    param([Hashtable]$data)
    $pso = [PSCustomObject]::new()
    if ($data) {
        foreach ($key in $data.Keys) {
            $pso.PSObject.Properties.Add([PSNoteProperty]::new($key, $data[$key]))
        }
    }
    return $pso
}

function New-Axpso {
    [CmdletBinding()]
    [Alias('axpso')]
    param([Hashtable]$data)
    $pso = [PSObject]::new()
    if ($data) {
        foreach ($key in $data.Keys) {
            $pso.PSObject.Properties.Add([PSNoteProperty]::new($key, $data[$key]))
        }
    }
    return $pso
}

function New-Axht {
    [CmdletBinding()]
    [Alias('axht')]
    param([Hashtable]$data)
    return $data ?? @{}
}

function New-Axdic {
    [CmdletBinding()]
    [Alias('axdic')]
    param([Hashtable]$data)
    $dic = [System.Collections.Generic.Dictionary[string, object]]::new()
    if ($data) {
        foreach ($key in $data.Keys) {
            $dic.Add($key.ToString(), $data[$key])
        }
    }
    return $dic
}

function New-Axsdic {
    [CmdletBinding()]
    [Alias('axdic')]
    param([Hashtable]$data)
    $dic = [System.Collections.Generic.Dictionary[string, object]]::new()
    if ($data) {
        foreach ($key in $data.Keys) {
            $dic.Add($key.ToString(), $data[$key])
        }
    }
    return $dic
}

function New-Axsl {
    [CmdletBinding()]
    [Alias('axsl')]
    param([Hashtable]$data)
    $sl = [System.Collections.SortedList]::new()
    if ($data) {
        foreach ($key in $data.Keys) {
            $sl.Add($key, $data[$key])
        }
    }
    return $sl
}

function Convert-AxData {
    [CmdletBinding()]
    [Alias('axdata')]
    param(
        [Parameter(Mandatory = $true, ValueFromPipeline = $true)]
        [object]$ObjectPointer,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Hashtable', 'OrderedHashTable', 'PSObject', 'PSCustomObject', 'SortedList', 'Dictionary', 'OrderedDictionary')]
        [string]$Type
    )

    process {
        # because an ordered hashtable is actually a dictionary for OHT only
        if ($type -eq 'OrderedHashTable') { $type = 'OrderedDictionary' }
        
        # check if type is string or int or bool
        if ($ObjectPointer -is [string] -or $ObjectPointer -is [int] -or $ObjectPointer -is [bool]) {
            _logr "Input data type '$(($ObjectPointer.GetType()).Name)' is not supported for conversion." 'convert' 'err' 'auspex-convert'
            return;
        }

        # 1. Input Validation & normalization
        # We need to extract Key/Value pairs regardless of whether source is a Dict or an Object
        $kvPairs = @()

        if ($ObjectPointer -is [System.Collections.IDictionary]) {
            # Handle Hashtables, OrderedDictionaries, SortedLists
            $kvPairs = $ObjectPointer.GetEnumerator() | Select-Object Key, Value
        }
        elseif ($ObjectPointer -is [PSObject] -or $ObjectPointer -is [System.Management.Automation.PSCustomObject]) {
            # Handle PSObjects and CustomObjects
            # We map 'Name' to 'Key' to standardize the loop below
            $kvPairs = $ObjectPointer.PSObject.Properties | Select-Object @{N = 'Key'; E = { $_.Name } }, Value
        }
        else {
            _logr "Input data type '$(($ObjectPointer.GetType()).Name)' is not supported." 'convert' 'err' 'auspex-convert'
            return
        }

        # 2. Conversion Logic
        switch ($Type) {
            'Hashtable' {
                $Data = @{}
                foreach ($item in $kvPairs) { $Data[$item.Key] = $item.Value }
                return $Data
            }

            'OrderedDictionary' {
                $Data = [ordered]@{}
                foreach ($item in $kvPairs) { $Data[$item.Key] = $item.Value }
                return $Data
            }

            'PSObject' {
                # In PowerShell, PSObject and PSCustomObject are functionally identical for data holding
                $Data = [ordered]@{}
                foreach ($item in $kvPairs) { $Data[$item.Key] = $item.Value }
                return [PSCustomObject]$Data
            }

            'PSCustomObject' {
                $Data = [ordered]@{}
                foreach ($item in $kvPairs) { $Data[$item.Key] = $item.Value }
                return [PSCustomObject]$Data
            }

            'SortedList' {
                $Data = New-Object -TypeName System.Collections.SortedList
                foreach ($item in $kvPairs) { 
                    if ($null -ne $item.Key) { $Data.Add($item.Key, $item.Value) }
                }
                return $Data
            }

            'Dictionary' {
                $Data = New-Object -TypeName 'System.Collections.Generic.Dictionary[string, object]'
                foreach ($item in $kvPairs) {
                    if ($null -ne $item.Key) { 
                        # Cast key to string to satisfy the generic definition
                        $Data[[string]$item.Key] = $item.Value 
                    }
                }
                return $Data
            }
        }
    }
}

# ---- Helper Functions ----
function Resolve-AuspexPath {
    [CmdletBinding()]
    [Alias('axpath')]
    param(
        [Parameter(Mandatory)]
        [object]$Root,
        [Parameter(Mandatory)]
        [string]$Path
    )
    
    # Tokenize: Split by dot, keep brackets
    $tokens = $Path -split '(?<!\\)\.|(?=\[)' | Where-Object { $_ -and $_ -ne '.' }

    $current = $Root
    $parent = $null
    $key = $null

    foreach ($token in $tokens) {
        $parent = $current
        
        if ($null -eq $parent) { return $null }

        # --- Handle Bracket Access ---
        if ($token -match '^\[(.*)\]$') {
            $inner = $matches[1]

            # 1. Integer Index: [0]
            if ($inner -match '^\d+$') {
                $key = [int]$inner
                try { $current = $parent[$key] } catch { $current = $null }
            } 
            # 2. Query Match: [key=val] OR [key=val&key2=val2]
            else {
                # Split by '&' to support multiple conditions: "type=ver&plat=npm"
                $conditions = $inner -split '&'
                
                if ($parent -is [System.Collections.IList]) {
                    $foundIndex = -1
                    
                    # Iterate through every item in the list
                    for ($i = 0; $i -lt $parent.Count; $i++) {
                        $item = $parent[$i]
                        $allMatch = $true

                        # Check ALL conditions against this item
                        foreach ($cond in $conditions) {
                            # Regex to parse "key=value" or "key='value'"
                            if ($cond -match "^(?<Prop>.+?)(?:=|eq)(?<Val>['`"]?.+?['`"]?)$") {
                                $pName = $matches.Prop.Trim()
                                $pVal = $matches.Val -replace "['`"]", "" # Strip quotes
                                
                                # If property missing or value mismatch, fail this item
                                if ($item.$pName -ne $pVal) {
                                    $allMatch = $false
                                    break 
                                }
                            }
                        }

                        if ($allMatch) {
                            $foundIndex = $i
                            break # Found the item that matches ALL criteria
                        }
                    }

                    if ($foundIndex -ne -1) {
                        $key = $foundIndex
                        $current = $parent[$key]
                    }
                    else {
                        $current = $null
                    }
                }
            }
        } 
        # --- Handle Dot Property ---
        else {
            $key = $token
            if ($parent -is [System.Collections.IDictionary]) {
                $current = $parent[$key]
            }
            else {
                $current = $parent.$key
            }
        }
    }

    return [PSCustomObject]@{
        Parent     = $parent
        Key        = $key
        Value      = $current
        ParentType = if ($parent) { $parent.GetType().FullName } else { $null }
    }
}

function Show-AuspexGraph {
    [CmdletBinding()]
    [Alias("ObjectGrapher", "graph", "auspex-graph")]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [object]$InputObject,

        [int]$Depth = 5,
        
        # Internal recursion params
        [string]$Name = "Root",
        [string]$Indent = "",
        [bool]$IsLast = $true,
        [int]$CurrentDepth = 0
    )

    # --- ANSI Escape Palette (The "Auspex" Theme) ---
    $e   = [char]27
    $Rst = "$e[0m"
    $Gra = "$e[90m"  # Dark Gray (Structure/Brackets)
    $Cyn = "$e[36m"  # Cyan (Property Names)
    $Grn = "$e[32m"  # Green (Types)
    $Yel = "$e[33m"  # Yellow (Counts/Metadata)
    $Red = "$e[31m"  # Red (Null/Empty)
    $Blu = "$e[34m"  # Blue (Values)

    # 1. Analyze Object
    $typeStr = "$Gra[$Grn$($InputObject.GetType().Name)$Gra]$Rst"
    $countStr = ""
    $valuePreview = ""
    $children = @()

    if ($null -eq $InputObject) {
        $typeStr = "$Gra[$Red`Null$Gra]$Rst"
    }
    else {
        # Check for Collections
        if ($InputObject -is [System.Collections.IDictionary]) {
            $countStr = " $Gra($Yel`Count: $($InputObject.Count)$Gra)$Rst"
            foreach ($key in $InputObject.Keys) {
                $children += @{ Name = $key; Value = $InputObject[$key] }
            }
        }
        elseif ($InputObject -is [System.Collections.IList] -and $InputObject.GetType().Name -ne "String") {
            $countStr = " $Gra($Yel`Count: $($InputObject.Count)$Gra)$Rst"
            for ($i = 0; $i -lt $InputObject.Count; $i++) {
                $children += @{ Name = "[$i]"; Value = $InputObject[$i] }
            }
        }
        elseif ($InputObject -is [System.Management.Automation.PSObject] -and 
                $InputObject.GetType().Name -ne "String" -and 
                -not $InputObject.GetType().IsPrimitive) {
            
            $props = $InputObject.PSObject.Properties | Where-Object { $_.MemberType -in "NoteProperty","Property" }
            foreach ($p in $props) {
                $children += @{ Name = $p.Name; Value = $p.Value }
            }
        }
        else {
            # It's a leaf node (String, Int, Bool, etc.) -> Show Value
            $val = "$($InputObject)"
            if ($val.Length -gt 50) { $val = $val.Substring(0, 47) + "..." }
            $valuePreview = " $Gra= $Blu$val$Rst"
        }
    }

    # 2. Render Node
    # Markers: ├── or └──
    $marker = if ($CurrentDepth -eq 0) { "" } elseif ($IsLast) { "└── " } else { "├── " }
    
    # Construct the full ASCII line
    $line = "$Indent$Gra$marker$Cyn$Name $typeStr$valuePreview$countStr$Rst"
    
    # Write directly to host
    [Console]::WriteLine($line)

    # 3. Recurse
    if ($CurrentDepth -lt $Depth -and $children.Count -gt 0) {
        
        $depth_indent = if ($CurrentDepth -eq 0) { "" } elseif ($IsLast) { "    " } else { "│   " }
        
        $childIndent = $Indent + $depth_indent

        for ($i = 0; $i -lt $children.Count; $i++) {
            $child = $children[$i]
            $isLastChild = ($i -eq ($children.Count - 1))
            
            Show-AuspexGraph -InputObject $child.Value `
                             -Name $child.Name `
                             -Depth $Depth `
                             -Indent $childIndent `
                             -IsLast $isLastChild `
                             -CurrentDepth ($CurrentDepth + 1)
        }
    }
}

# ---- Main Function: Invoke-auspex ----
function Invoke-Auspex {
    [CmdletBinding(DefaultParameterSetName = 'CrudOperation')]
    [Alias('ax', 'auspex')]
    param(
        [Parameter(Mandatory, Position = 0)]
        $ObjectPointer,

        [validateSet('create','read','update','delete','push','pull')]
        [Parameter(Mandatory, ParameterSetName = 'CrudOperation', Position = 1)]
        [string]$Action,
        
        [Parameter(Mandatory, ParameterSetName = 'CrudOperation', Position = 2)]
        [string]$KeyName, # Acts as Path (e.g. 'items[0].name')
        
        [Parameter(Mandatory = $false, ParameterSetName = 'CrudOperation', Position = 3)]
        [object]$Value,
        
        [Parameter(Mandatory = $false, ParameterSetName = 'GraphOperation')]
        [switch]$Grapher,
        
        [switch]$Log,
        
        [string]$EmbeddedName
    )

    # output graph if Grapher parameter set is used at the top level
    if ($objectPointer -and $PSCmdlet.ParameterSetName -eq 'GraphOperation') {
        Show-AuspexGraph -InputObject $ObjectPointer -Depth 10
        return;
    }

    # Resolve Context
    $ctx = Resolve-AuspexPath -Root $ObjectPointer -Path $KeyName

    # Use PSBOUNDParameters to intercept Graph parameter set to check if only the ObjecPointer is provided
    # if ($PSBoundParameters.ContainsKey('Graph') -and 
    #     $PSBoundParameters.name -eq 'GraphOperation' -and -not $PSBoundParameters.ContainsKey('Action') -and
    #     -not $PSBoundParameters.ContainsKey('KeyName') -and -not $PSBoundParameters.ContainsKey('Value')) {
    #     Show-AuspexGraph -InputObject $ObjectPointer -Depth 5
    #     return;
    # }

    # USE PSBoundParameters to intercept Graph parameter set
    if ($PSBoundParameters.ContainsKey('Grapher') -and $PSBoundParameters.name -eq 'GraphOperation') {
        Show-AuspexGraph -InputObject $ctx -Depth 5
        return;
    }

    # USE PSBoundParameters to intercept Log parameter set
    if ($PSBoundParameters.ContainsKey('Log')) {
        $global:__logging = $true
    }

    # handle EnbeddedName
    if ($PSBoundParameters.ContainsKey('EmbeddedName') -eq $null) {
       $EmbeddedName = $EmbeddedName
    }

    # set log name
    [string] $logname = 'auspex'

    # Validation: We need a valid Parent for write operations
    if ($Action -in 'create', 'read', 'update', 'delete', 'push', 'pull') {
        if (-not $ctx.Parent) {
            _logr "Path could not be resolved. Parent container missing for $(kvinc 'Path' $KeyName 'err')" 'check' 'chk' $logname 
            return
        }
    }

    $dataType = $ctx.ParentType

    try {
        switch ($Action) {
            'read' {
                if ($null -ne $ctx.Value) {
                    _logr "$(kvinc "Property" $KeyName) retrieved from ⇒ (`e[13;4m$dataType`e[0m)" 'read' 'inf' $logname
                    return $ctx.Value
                }
                _logr "$(kvinc "Property" $KeyName) not found in ⇒ (`e[13;4m$dataType`e[0m)" 'read' 'wrn' $logname 
                return $null
            }

            'create' {
                # Logic: Only add if it DOES NOT exist. 
                if ($null -ne $ctx.Value) {
                    _logr "$(kvinc "Property" $KeyName) already exists in ⇒ (`e[13;4m$dataType`e[0m). Use 'update' to modify" 'create' 'wrn' $logname
                    return
                }

                if ($ctx.Parent -is [System.Collections.IDictionary]) {
                    $ctx.Parent.Add($ctx.Key, $Value)
                    _logr "$(kvinc "Property" $KeyName) created in ⇒ (`e[13;4m$dataType`e[0m)" 'create' 'inf' $logname
                } 
                elseif ($ctx.Parent -is [PSObject]) {
                    $ctx.Parent | Add-Member -MemberType NoteProperty -Name $ctx.Key -Value $Value -Force
                    _logr "$(kvinc "Property" $KeyName) created in ⇒ (`e[13;4m$dataType`e[0m)" 'create' 'inf' $logname
                }
                else {
                    # Generic Object fallback (POCOs) - often cannot dyn add properties
                    _logr "Cannot dynamically add property $(kvinc "Property" $KeyName) to fixed type ⇒ (`e[13;4m$dataType`e[0m)" 'create' 'err' $logname
                }
            }

            'update' {
                if ($ctx.Parent -is [System.Collections.IDictionary] -or $ctx.Parent -is [System.Collections.IList]) {
                    # Dictionary or Array Index
                    if ($ctx.Parent -is [System.Collections.IDictionary] -and -not $ctx.Parent.Contains($ctx.Key)) {
                        _logr "$(kvinc "Property" $KeyName) not found for update in ⇒ (`e[13;4m$dataType`e[0m)" 'update' 'wrn' $logname
                    } else {
                        $ctx.Parent[$ctx.Key] = $Value
                        _logr "$(kvinc "Property" $KeyName) updated in ⇒ (`e[13;4m$dataType`e[0m)" 'update' 'inf' $logname
                    }
                } else {
                    # PSObject / Object
                    # Check existence via Value check or PSObject properties
                    if ($null -ne $ctx.Value -or $ctx.Parent.PSObject.Properties.Match($ctx.Key).Count -gt 0) {
                        $ctx.Parent.($ctx.Key) = $Value
                        _logr "$(kvinc "Property" $KeyName) updated in ⇒ (`e[13;4m$dataType`e[0m)" 'update' 'inf' $logname
                    } else {
                        _logr "$(kvinc "Property" $KeyName) not found for update in ⇒ (`e[13;4m$dataType`e[0m)" 'update' 'wrn' $logname 
                    }
                }
            }

            'delete' {
                if ($ctx.Parent -is [System.Collections.IDictionary]) {
                    if ($ctx.Parent.Contains($ctx.Key)) {
                        $ctx.Parent.Remove($ctx.Key)
                        _logr "$(kvinc "Property" $KeyName) deleted in ⇒ (`e[13;4m$dataType`e[0m)" 'delete' 'inf' $logname 
                    } else {
                        _logr "$(kvinc "Property" $KeyName) not found for delete in ⇒ (`e[13;4m$dataType`e[0m)" 'delete' 'wrn' $logname
                    }
                } 
                elseif ($ctx.Parent -is [System.Collections.IList]) {
                    try {
                        $ctx.Parent.RemoveAt($ctx.Key)
                        _logr "$(kvinc "Index" $KeyName) removed from list ⇒ (`e[13;4m$dataType`e[0m)" 'delete' 'inf' $logname
                    } catch {
                        _logr "Failed to remove index $(kvinc "Index" $KeyName) from ⇒ (`e[13;4m$dataType`e[0m), List might be fixed size." 'delete' 'err' $logname
                    }
                }
                else {
                    # PSObject
                    if ($ctx.Parent.PSObject.Properties.Match($ctx.Key).Count -gt 0) {
                        $ctx.Parent.PSObject.Properties.Remove($ctx.Key)
                        _logr "$(kvinc "Property" $KeyName) deleted in ⇒ (`e[13;4m$dataType`e[0m)" 'delete' 'inf' $logname
                    } else {
                        _logr "$(kvinc "Property" $KeyName) not found for delete in ⇒ (`e[13;4m$dataType`e[0m)" 'delete' 'err' $logname
                    }
                }
            }

            'push' {
                $currentArr = $ctx.Value
                if ($null -eq $currentArr) { $currentArr = @() }

                if ($currentArr -is [System.Array] -or $currentArr -is [System.Collections.IList]) {
                    $newValue = $currentArr + $Value
                    
                    # Write back to parent
                    if ($ctx.Parent -is [System.Collections.IDictionary] -or $ctx.Parent -is [System.Collections.IList]) {
                        $ctx.Parent[$ctx.Key] = $newValue
                    } else {
                        $ctx.Parent.($ctx.Key) = $newValue
                    }
                    _logr "$(kvinc "Property" $KeyName) pushed to ⇒ (`e[13;4m$dataType`e[0m)" 'push' 'inf' $logname
                } else {
                    _logr "Push action only works on array-type properties. ⇒ (`e[13;4m$KeyName`e[0m) is not an array" 'push' 'wrn' $logname
                }
            }

            'pull' {
                $currentArr = $ctx.Value
                if ($currentArr -is [System.Array] -or $currentArr -is [System.Collections.IList]) {
                    $newValue = @($currentArr) | Where-Object { $_ -ne $Value }

                    if ($ctx.Parent -is [System.Collections.IDictionary] -or $ctx.Parent -is [System.Collections.IList]) {
                        $ctx.Parent[$ctx.Key] = $newValue
                    } else {
                        $ctx.Parent.($ctx.Key) = $newValue
                    }
                    _logr "Pulled value from array $(kvinc "Property" $KeyName "inf")" 'pull' 'inf' $logname
                } else {
                    _logr "Pull action only works on array-type properties. ⇒ (`e[13;4m$KeyName`e[0m) is not an array" 'pull' 'wrn' $logname
                }
            }
        }
    }
    catch {
        _logr "FATAL ERROR: An unexpected error occurred during action '$($Action)' on '$($KeyName)'" 'error' 'err' $logname
        _logr "Exception: $($_.Exception.Message)" 'error' 'err' $logname
        _logr "Stack Trace: $($_.ScriptStackTrace)" 'error' 'err' $logname
    }
}

# Set Aliases mapping manuall incase Export-ModuleMember misses any
Set-Alias -Name auspex  -Value Invoke-AusPex        -Scope Global
Set-Alias -Name ax      -Value Invoke-AusPex        -Scope Global
Set-Alias -Name axdata  -Value Convert-AxData       -Scope Global
Set-Alias -Name axpath  -Value Resolve-AuspexPath   -Scope Global
Set-Alias -Name axpsco  -Value New-AxPsco           -Scope Global
Set-Alias -Name axpso   -Value New-Axpso            -Scope Global
Set-Alias -Name axht    -Value New-Axht             -Scope Global
Set-Alias -Name axdic   -Value New-Axdic            -Scope Global
Set-Alias -Name axsl    -Value New-Axsl             -Scope Global

$module_config = @{
    function = @(
        'Invoke-AusPex',
        'Convert-AxData',
        'Resolve-auspexPath',
        'New-AxPsco',
        'New-AxPso',
        'New-AxHt',
        'New-Axdic',
        'New-Axsl'
    )
    alias = @(
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
}

Export-ModuleMember @module_config