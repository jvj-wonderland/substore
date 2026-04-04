package chibi

import (
	"reflect"
	"testing"
)

func TestNewContext(t *testing.T) {
	ctx := NewContext()
	if ctx == nil {
		t.Fatal("Failed to create context")
	}
}

func TestExecute(t *testing.T) {
	ctx := NewContext()
	res, err := ctx.Execute("(+ 1 2 3)")
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if res != int64(6) {
		t.Errorf("Expected 6, got %v (%T)", res, res)
	}
}

func TestDefine(t *testing.T) {
	ctx := NewContext()
	err := ctx.Define("x", int64(42))
	if err != nil {
		t.Fatalf("Define failed: %v", err)
	}

	res, err := ctx.Execute("x")
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}
	if res != int64(42) {
		t.Errorf("Expected 42, got %v", res)
	}
}

func TestConversions(t *testing.T) {
	ctx := NewContext()

	tests := []struct {
		name     string
		input    any
		expected any
	}{
		{"int", int64(10), int64(10)},
		{"float", 3.14, 3.14},
		{"string", "hello", "hello"},
		{"bool-true", true, true},
		{"bool-false", false, false},
		{"slice", []any{int64(1), "two", 3.0}, []any{int64(1), "two", 3.0}},
		{"map", map[string]any{"a": int64(1), "b": "two"}, map[string]any{"a": int64(1), "b": "two"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := ctx.GoToSexp(tt.input)
			got := ctx.SexpToGo(s)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestAlistConversion(t *testing.T) {
	ctx := NewContext()
	// Create an alist in Scheme and convert to Go map
	res, err := ctx.Execute("'((a . 1) (b . 2))")
	if err != nil {
		t.Fatalf("Execute failed: %v", err)
	}

	expected := map[string]any{"a": int64(1), "b": int64(2)}
	if !reflect.DeepEqual(res, expected) {
		t.Errorf("Expected %v, got %v", expected, res)
	}
}

func TestSchemeException(t *testing.T) {
	ctx := NewContext()
	_, err := ctx.Execute("(/ 1 0)")
	if err == nil {
		t.Error("Expected error for division by zero, got nil")
	}
}

func TestChildContext(t *testing.T) {
	parent := NewContext()
	err := parent.Define("shared", int64(100))
	if err != nil {
		t.Fatalf("Define in parent failed: %v", err)
	}

	child := parent.ChildContext()
	res, err := child.Execute("shared")
	if err != nil {
		t.Fatalf("Execute in child failed: %v", err)
	}

	if res != int64(100) {
		t.Errorf("Expected 100 in child, got %v", res)
	}

	err = child.Define("child-only", int64(200))
	if err != nil {
		t.Fatalf("Define in child failed: %v", err)
	}

	res, err = parent.Execute("child-only")
	if err != nil {
		t.Fatalf("Execute in parent for child variable failed: %v", err)
	}
	if res != int64(200) {
		t.Errorf("Expected 200 in parent (since they share environment), got %v", res)
	}
}
