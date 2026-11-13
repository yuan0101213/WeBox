package com.webox.common;

import java.util.Map;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.RedisConnectionFailureException;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    ResponseEntity<?> oversized(Exception ex) {
        return ResponseEntity.status(413)
                .body(Map.of("code", "IMAGE_TOO_LARGE", "message", "Image must be at most 5 MB."));
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> business(ApiException ex) {
        return ResponseEntity.status(ex.status)
                .body(Map.of("code", ex.code, "message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> validation(MethodArgumentNotValidException ex) {
        String message =
                ex.getBindingResult().getFieldErrors().stream()
                        .findFirst()
                        .map(e -> e.getField() + ": " + e.getDefaultMessage())
                        .orElse("Invalid input.");
        return ResponseEntity.badRequest()
                .body(Map.of("code", "INVALID_INPUT", "message", message));
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class
    })
    ResponseEntity<?> malformed(Exception ex) {
        return ResponseEntity.badRequest()
                .body(
                        Map.of(
                                "code",
                                "INVALID_INPUT",
                                "message",
                                "Please provide valid request values."));
    }

    @ExceptionHandler({DataAccessException.class, RedisConnectionFailureException.class})
    ResponseEntity<?> unavailable(Exception ex) {
        LoggerFactory.getLogger(ApiErrors.class).error("A dependency request failed", ex);
        return ResponseEntity.status(503)
                .body(
                        Map.of(
                                "code",
                                "SERVICE_UNAVAILABLE",
                                "message",
                                "The service is temporarily unavailable. Please try again."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception ex) {
        LoggerFactory.getLogger(ApiErrors.class).error("Unexpected request failure", ex);
        return ResponseEntity.internalServerError()
                .body(
                        Map.of(
                                "code",
                                "INTERNAL_ERROR",
                                "message",
                                "Something went wrong. Please try again."));
    }
}
