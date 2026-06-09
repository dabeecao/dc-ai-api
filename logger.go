package main

import (
	"fmt"
	"log"
)

func LogInfo(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[INFO] %s", msg)
}

func LogWarn(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[WARN] %s", msg)
}

func LogError(format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	log.Printf("[ERROR] %s", msg)
}
