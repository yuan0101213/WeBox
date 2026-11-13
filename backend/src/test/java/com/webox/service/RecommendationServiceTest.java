package com.webox.service;

import com.fasterxml.jackson.databind.*;
import com.webox.repository.WeBoxRepository;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class RecommendationServiceTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void rejectsUnknownDuplicateAndExcessSelections() {
        assertTrue(RecommendationService.validSelection(2,"Light",Set.of(2L),Set.of()));
        assertFalse(RecommendationService.validSelection(3,"Light",Set.of(2L),Set.of()));
        assertFalse(RecommendationService.validSelection(2,"Light",Set.of(2L),Set.of(2L)));
        assertFalse(RecommendationService.validSelection(2,"Light",Set.of(2L),Set.of(3L,4L,5L)));
        assertFalse(RecommendationService.validSelection(2," ",Set.of(2L),Set.of()));
    }
    @Test void parsesSplitJsonFencesAndFinalLine() throws Exception {
        List<JsonNode> out=new ArrayList<>();var parser=new RecommendationService.LineParser(json,out::add);
        parser.accept("```json\n{\"dish");parser.accept("Id\":4,\"reason\":\"Fresh\"}\ninvalid\n");
        parser.accept("{\"dishId\":5,\"reason\":\"Light\"}");parser.finish();
        assertEquals(List.of(4,5),out.stream().map(n->n.path("dishId").asInt()).toList());
    }
    @Test void readsSseThroughFragmentedTransport() throws Exception {
        String a=json.writeValueAsString(Map.of("choices",List.of(Map.of("delta",Map.of("content","{\"dishId\":8,")))));
        String b=json.writeValueAsString(Map.of("choices",List.of(Map.of("delta",Map.of("content","\"reason\":\"Good choice\"}\n")))));
        byte[] bytes=("data: "+a+"\n\ndata: "+b+"\n\ndata: [DONE]\n\n").getBytes(StandardCharsets.UTF_8);
        InputStream fragmented=new ByteArrayInputStream(bytes){@Override public synchronized int read(byte[] b,int off,int len){return super.read(b,off,Math.min(len,3));}};
        List<JsonNode> out=new ArrayList<>();RecommendationService.readStream(fragmented,json,new RecommendationService.LineParser(json,out::add),new AtomicBoolean());
        assertEquals(8,out.get(0).path("dishId").asInt());assertEquals(1,out.size());
    }
    @Test void rejectsTruncatedAndOversizedStreams() throws Exception {
        var parser=new RecommendationService.LineParser(json,n->{});
        assertThrows(IOException.class,()->parser.accept("x".repeat(16001)));
        assertThrows(IOException.class,()->RecommendationService.readStream(new ByteArrayInputStream(new byte[0]),json,parser,new AtomicBoolean()));
    }
    @Test void allowlistsPreferencesAndFiltersAllergensIgnoringCase() throws Exception {
        var db=new WeBoxRepository(new org.springframework.jdbc.core.JdbcTemplate(),json);
        var service=new RecommendationService(db,null,null,json,"test","deepseek-flash","http://localhost");
        try {
            var prefs=json.readTree("{\"allergens\":[\"Soy\"],\"email\":\"private@example.com\",\"address\":\"Secret house\",\"token\":\"secret-token\"}");
            String prompt=service.buildPrompt("A light lunch",prefs,Set.of(9L),List.of(Map.of("id",2)));
            assertFalse(prompt.contains("private@example.com"));assertFalse(prompt.contains("Secret house"));assertFalse(prompt.contains("secret-token"));assertTrue(prompt.contains("recentDishIds"));
            assertFalse(service.allowed(Map.of("allergens_json","[\"SOY\"]"),Set.of("soy")));
            assertTrue(service.allowed(Map.of("allergens_json","[\"Egg\"]"),Set.of("soy")));
        } finally {service.close();}
    }
}
