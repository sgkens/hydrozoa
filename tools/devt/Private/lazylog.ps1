function Write-LazyLog {
    <#
        Helper Function: Write-LazyLog
        Type: Advanced function
        ------------------
        Levels: inf, wrn, err, suc, act, fail
        Log a message with a specific action and type
        ! Will not log if $script:log or $global:__logging is not set to $true 
        * Verbose parameter will override $script:log and $global:__logging
        * Global logging flag will override $script:log and $verbose
        
        --* Example:
        
        Write-LazyLog 'This is my message with create action and inf type' 'create' 'inf'
        Output:
        PSLazy > INF | create -> This is my message with create action and inf type
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet('inf', 'wrn', 'err', 'suc', 'act', 'fail')]
        [string]$Level,

        [Parameter(Mandatory)]
        [string]$Message,

        [Parameter(Mandatory)]
        [string]$Title,

        [string]$Context,  # e.g. module name or operation

        [switch]$log  # Optional override for logging
    )

    if (-not ($global:__logging -or $log)) {
        return
    }

    $levelConfig = @{
        inf  = @{ Label = ' INF '; FG = 'Cyan'; BG = 'DarkCyan' }
        wrn  = @{ Label = ' WRN '; FG = 'Yellow'; BG = 'DarkYellow' }
        err  = @{ Label = ' ERR '; FG = 'Red'; BG = 'DarkRed' }
        suc  = @{ Label = ' SUC '; FG = 'Green'; BG = 'DarkGreen' }
        act  = @{ Label = ' ACT '; FG = 'Magenta'; BG = 'DarkMagenta' }
        fail = @{ Label = 'FAIL '; FG = 'White'; BG = 'DarkRed' }
    }

    $cfg = $levelConfig[$Level]

    if (!$Title) {
        $Title = ''
    } else {
        $Title = "$Title "
    }

    # Prefix
    Write-Host $Title -ForegroundColor White -NoNewline
    Write-Host '> ' -ForegroundColor DarkGray -NoNewline

    # Badge
    Write-Host $cfg.Label -ForegroundColor $cfg.FG -BackgroundColor $cfg.BG -NoNewline
    Write-Host ' ' -NoNewline

    # Optional context in accent color
    if ($Context) {
        Write-Host "[$Context] " -ForegroundColor DarkGray -NoNewline
    }

    # Message
    Write-Host $Message -ForegroundColor $cfg.FG

    # Mirror errors to error stream as well
    if ($Level -in 'err', 'fail') {
        Write-Error "PSLazy: $Message" -ErrorAction Continue
    }
}