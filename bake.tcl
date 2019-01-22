# Oddstream Loops builder
# Invoke with tclsh bake.tcl [local | db] from the Loops directory
# Using with ActiveTcl 8.6.8 from www.activestate.com
# Using / as a pathname separator, which gets mapped to \

proc xcopy {fname dst} {
  # fname is a file name e.g. "Usk.html"
  # dst is a directory name with a trailing path separator e.g. "c:\\inetpub\\wwwroot\\solitaire"
  # fname is only copied to dst if src is newer than $dst$fname, or $dst$fname does not exist
  # puts "xcopy $fname $dst$fname"
  if { ![file exists $fname] } then {
    puts "$fname does not exist, cannot copy to $dst"
    return 1
  }
  if { [string index $dst end] ne "/" } then {
    set dst [string cat $dst "/"]
  }
  if { [file exists $dst$fname] } then {
    set srcTime [file mtime $fname]
    set dstTime [file mtime $dst$fname]
    if { $srcTime > $dstTime } then {
      puts "Updating $dst$fname"
      file copy -force $fname $dst$fname
    }
  } else {
    puts "Creating $dst$fname"
    file copy $fname $dst$fname
  }
  return 0
}

proc getVersion {fname} {
  set v "0.0.0.0"
  if { [file exists $fname] } then {
    set f [open $fname r]
    while { [gets $f line] != -1 } {
      if { [regexp {\d+\.\d+\.\d+\.\d+} $line value] } then {
          set v $value
          break
      }
    }
    close $f
  }
  puts "$v $fname"
  return $v
}

proc xcompile {fname dst} {
  if { [getVersion $fname] ne [getVersion $dst$fname] } then {
    puts "Compiling to $dst$fname"
    # puts [exec java -jar compiler.jar --version]
    puts [exec java -jar compiler.jar --js $fname --language_in ECMASCRIPT_2017 --language_out ECMASCRIPT_2015 --js_output_file $dst$fname]
  }
}

proc publish {dst} {
  foreach htmlFile [glob *.html] {
    xcopy $htmlFile $dst
  }

  xcompile Loop4.js $dst
  xcompile Loop6.js $dst
  xcompile Loop8.js $dst
  xcompile Util.js $dst
}

# start of doing things here

puts "Oddstream Loops builder"
puts "Tcl version [info tclversion]"

if { $argc > 0 } then {
  if { [lindex $argv 0] eq "local" } then {
    puts "Publishing to localhost"
    publish "c:/inetpub/wwwroot/solitaire/"
  } elseif { [lindex $argv 0] eq "db" } then {
    puts "Publishing to dropbox"
    publish "c:/Users/oddst/Dropbox/Apps/My.DropPages/oddstream.droppages.com/Public/"
  }
}

puts "Completed"
