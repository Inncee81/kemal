package Review.class04;

public class ArrayDemo {

	public static void main(String[] args) {
		int a0=5;
         int a1=7;
         int a2=8;
         int a3=9;
         int a4=20;
        //System.out.println(a1);
       // System.out.println(a2);
      //  System.out.println(a3);
      //  System.out.println(a4);
       // System.out.println(a5);
         //fisrt professional way
         //declaring all elements have the default value
	   int[] numbers=new int[5];
	   //initializing values fro array elements
	   numbers[3]=9;
	   numbers[2]=8;
	   numbers[1]=7;
	   numbers[0]=5;
	   numbers[4]=20;
	   
	   System.out.println(numbers[0]);
	   System.out.println(numbers[1]);
	   System.out.println(numbers[2]);
	   System.out.println(numbers[3]);
	   System.out.println(numbers[4]);
	   
	   int i=2;//printing the element with index 2,third element
	   System.out.println(numbers[i]);
	   i++;
	   System.out.println(numbers[i]);
	}  
}
