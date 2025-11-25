#Requires -Version 5.1
<#
.SYNOPSIS
    Centralized exception classes for claude-vibe plugin.

.DESCRIPTION
    Provides custom exception classes with rich context information for
    consistent error handling across all modules. These exceptions support
    detailed diagnostic information while maintaining clean error hierarchies.

.NOTES
    Author: claude-vibe
    Version: 1.0.0

    Usage Pattern:
    - Use specific exceptions for specific error categories
    - Always include relevant context (paths, operations, keys)
    - Rethrow specific exceptions, wrap generic ones
#>

#region Class Redefinition Guard

# PowerShell classes cannot be redefined in the same session.
# Check if classes already exist before defining them.
if ("JsonParsingException" -as [type]) {
    Write-Verbose "Exception classes already loaded, skipping redefinition"
    return
}

#endregion

#region JSON Parsing Exceptions

<#
.SYNOPSIS
    Exception for JSON parsing and structure errors.

.DESCRIPTION
    Thrown when JSON file reading, parsing, or structure validation fails.
    Includes file path and optional line number for debugging.
#>
class JsonParsingException : System.Exception {
    [string]$FilePath
    [int]$LineNumber
    [string]$ExpectedStructure

    JsonParsingException([string]$message) : base($message) {
        $this.FilePath = $null
        $this.LineNumber = -1
    }

    JsonParsingException([string]$message, [string]$filePath) : base($message) {
        $this.FilePath = $filePath
        $this.LineNumber = -1
    }

    JsonParsingException([string]$message, [string]$filePath, [int]$lineNumber) : base($message) {
        $this.FilePath = $filePath
        $this.LineNumber = $lineNumber
    }

    [string] ToString() {
        $msg = $this.Message
        if ($this.FilePath) {
            $msg += " [File: $($this.FilePath)"
            if ($this.LineNumber -gt 0) {
                $msg += ", Line: $($this.LineNumber)"
            }
            $msg += "]"
        }
        return $msg
    }
}

#endregion

#region Configuration Exceptions

<#
.SYNOPSIS
    Exception for configuration-related errors.

.DESCRIPTION
    Thrown when configuration values are missing, invalid, or inconsistent.
    Includes the configuration key and expected value information.
#>
class ConfigurationException : System.Exception {
    [string]$ConfigKey
    [string]$ConfigPath
    [object]$ExpectedValue
    [object]$ActualValue

    ConfigurationException([string]$message) : base($message) {}

    ConfigurationException([string]$message, [string]$configKey) : base($message) {
        $this.ConfigKey = $configKey
    }

    ConfigurationException([string]$message, [string]$configKey, [string]$configPath) : base($message) {
        $this.ConfigKey = $configKey
        $this.ConfigPath = $configPath
    }

    [string] ToString() {
        $msg = $this.Message
        if ($this.ConfigKey) {
            $msg += " [Key: $($this.ConfigKey)"
            if ($this.ConfigPath) {
                $msg += ", Path: $($this.ConfigPath)"
            }
            $msg += "]"
        }
        return $msg
    }
}

#endregion

#region Module Loading Exceptions

<#
.SYNOPSIS
    Exception for module loading and dependency errors.

.DESCRIPTION
    Thrown when module loading fails due to missing dependencies,
    circular dependencies, or file access issues.
#>
class ModuleLoadException : System.Exception {
    [string]$ModuleName
    [string]$ModulePath
    [string[]]$MissingDependencies
    [bool]$IsCircularDependency

    ModuleLoadException([string]$message) : base($message) {}

    ModuleLoadException([string]$message, [string]$moduleName) : base($message) {
        $this.ModuleName = $moduleName
    }

    ModuleLoadException([string]$message, [string]$moduleName, [string[]]$missingDeps) : base($message) {
        $this.ModuleName = $moduleName
        $this.MissingDependencies = $missingDeps
    }

    static [ModuleLoadException] CircularDependency([string]$moduleName, [string]$dependencyChain) {
        $ex = [ModuleLoadException]::new(
            "Circular dependency detected for module '$moduleName': $dependencyChain",
            $moduleName
        )
        $ex.IsCircularDependency = $true
        return $ex
    }

    [string] ToString() {
        $msg = $this.Message
        if ($this.ModuleName) {
            $msg += " [Module: $($this.ModuleName)"
            if ($this.MissingDependencies -and $this.MissingDependencies.Count -gt 0) {
                $msg += ", Missing: $($this.MissingDependencies -join ', ')"
            }
            $msg += "]"
        }
        return $msg
    }
}

#endregion

#region Command Exceptions

<#
.SYNOPSIS
    Exception for command management errors.

.DESCRIPTION
    Thrown when command registration, enabling, disabling, or execution fails.
#>
class CommandException : System.Exception {
    [string]$CommandName
    [string]$Operation
    [string]$SourcePath
    [string]$TargetPath

    CommandException([string]$message) : base($message) {}

    CommandException([string]$message, [string]$commandName) : base($message) {
        $this.CommandName = $commandName
    }

    CommandException([string]$message, [string]$commandName, [string]$operation) : base($message) {
        $this.CommandName = $commandName
        $this.Operation = $operation
    }

    [string] ToString() {
        $msg = $this.Message
        if ($this.CommandName) {
            $msg += " [Command: $($this.CommandName)"
            if ($this.Operation) {
                $msg += ", Operation: $($this.Operation)"
            }
            $msg += "]"
        }
        return $msg
    }
}

#endregion

#region Preset Exceptions

<#
.SYNOPSIS
    Exception for preset management errors.

.DESCRIPTION
    Thrown when preset loading, validation, or merging fails.
#>
class PresetException : System.Exception {
    [string]$PresetName
    [string]$PresetPath
    [string]$Operation

    PresetException([string]$message) : base($message) {}

    PresetException([string]$message, [string]$presetName) : base($message) {
        $this.PresetName = $presetName
    }

    PresetException([string]$message, [string]$presetName, [string]$operation) : base($message) {
        $this.PresetName = $presetName
        $this.Operation = $operation
    }

    [string] ToString() {
        $msg = $this.Message
        if ($this.PresetName) {
            $msg += " [Preset: $($this.PresetName)"
            if ($this.Operation) {
                $msg += ", Operation: $($this.Operation)"
            }
            $msg += "]"
        }
        return $msg
    }
}

#endregion

#region Validation Exceptions

<#
.SYNOPSIS
    Exception for input validation errors.

.DESCRIPTION
    Thrown when input validation fails. More specific than ArgumentException
    with support for multiple validation failures.
#>
class ValidationException : System.Exception {
    [string]$ParameterName
    [object]$Value
    [string[]]$ValidationErrors

    ValidationException([string]$message) : base($message) {}

    ValidationException([string]$message, [string]$parameterName) : base($message) {
        $this.ParameterName = $parameterName
    }

    ValidationException([string]$message, [string]$parameterName, [object]$value) : base($message) {
        $this.ParameterName = $parameterName
        $this.Value = $value
    }

    static [ValidationException] FromErrors([string]$parameterName, [string[]]$errors) {
        $message = "Validation failed for '$parameterName': " + ($errors -join '; ')
        $ex = [ValidationException]::new($message, $parameterName)
        $ex.ValidationErrors = $errors
        return $ex
    }

    [string] ToString() {
        $msg = $this.Message
        if ($this.ValidationErrors -and $this.ValidationErrors.Count -gt 0) {
            $msg += " [Errors: $($this.ValidationErrors.Count)]"
        }
        return $msg
    }
}

#endregion

#region Operation Result

<#
.SYNOPSIS
    Result object for operations that may partially succeed.

.DESCRIPTION
    Provides a standardized way to return results with success status,
    errors, and warnings for operations that may partially succeed.
#>
class OperationResult {
    [bool]$Success
    [object]$Value
    [string[]]$Errors
    [string[]]$Warnings
    [hashtable]$Metadata

    OperationResult() {
        $this.Success = $true
        $this.Errors = @()
        $this.Warnings = @()
        $this.Metadata = @{}
    }

    static [OperationResult] Succeeded([object]$value) {
        $result = [OperationResult]::new()
        $result.Value = $value
        return $result
    }

    static [OperationResult] Failed([string]$error) {
        $result = [OperationResult]::new()
        $result.Success = $false
        $result.Errors = @($error)
        return $result
    }

    static [OperationResult] Failed([string[]]$errors) {
        $result = [OperationResult]::new()
        $result.Success = $false
        $result.Errors = $errors
        return $result
    }

    [void] AddError([string]$error) {
        $this.Errors += $error
        $this.Success = $false
    }

    [void] AddWarning([string]$warning) {
        $this.Warnings += $warning
    }

    [bool] HasWarnings() {
        return $this.Warnings.Count -gt 0
    }
}

#endregion

#region Module Export

if ($MyInvocation.MyCommand.ScriptBlock.Module) {
    # Export exception classes - they're available once the script is dot-sourced
    Write-Verbose "Loaded exception classes: JsonParsingException, ConfigurationException, ModuleLoadException, CommandException, PresetException, ValidationException, OperationResult"
}

#endregion
